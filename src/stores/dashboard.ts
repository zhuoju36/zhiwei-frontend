import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { listAllDevices } from '@/api/device'
import { listAllChannels } from '@/api/channel'
import { listAllModels } from '@/api/model'
import { listAllPoints } from '@/api/point'
import { listAllSensors } from '@/api/sensor'
import { listAllSubitems } from '@/api/subitem'
import { useUserStore } from '@/stores/user'
import type { Channel, Device, ModelInfo, Point, Sensor, Subitem } from '@/types'

const SUBITEM_KEY = 'shm_current_subitem_id'
const LEGACY_PROJECT_KEY = 'shm_current_project_id'

/** 读取持久化子项 id：优先新 key；旧 key（项目）存在时迁移 */
function readStoredSubitemId(): number | null {
  let raw = localStorage.getItem(SUBITEM_KEY)
  if (raw == null) {
    raw = localStorage.getItem(LEGACY_PROJECT_KEY)
    if (raw != null) {
      localStorage.removeItem(LEGACY_PROJECT_KEY)
      localStorage.setItem(SUBITEM_KEY, raw)
    }
  }
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 有限并发执行：限制同时 in-flight 请求数，避免千级测点/传感器一次性打满连接 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let idx = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

export const useDashboardStore = defineStore('dashboard', () => {
  const subitems = ref<Subitem[]>([])
  const storedId = readStoredSubitemId()
  const currentSubitemId = ref<number | null>(storedId)
  const selectedChannelId = ref<number | null>(null)
  const loading = ref(false)

  // 子项 → 设备 → 测点 → 传感器 → 通道 全链路数据（供大屏/分析联动）
  const devices = ref<Device[]>([])
  const points = ref<Point[]>([])
  const sensors = ref<Sensor[]>([])
  const channels = ref<Channel[]>([])
  const models = ref<ModelInfo[]>([])
  const pointsLoading = ref(false)
  const channelsLoading = ref(false)

  /** channel_id → point_id（WS 实时数据按通道推送，3D 按测点变色需反查） */
  const channelPointMap = ref<Record<number, number>>({})

  const pointMap = computed(() => new Map(points.value.map((p) => [p.id, p])))
  const channelMap = computed(() => new Map(channels.value.map((c) => [c.id, c])))
  const currentSubitem = computed<Subitem | null>(
    () => subitems.value.find((s) => s.id === currentSubitemId.value) ?? null,
  )

  /** 测点 → 其下通道 id 列表（3D 点击测点选中首个通道） */
  const channelIdsByPoint = computed<Record<number, number[]>>(() => {
    const map: Record<number, number[]> = {}
    Object.entries(channelPointMap.value).forEach(([channelId, pointId]) => {
      const list = map[pointId] ?? (map[pointId] = [])
      list.push(Number(channelId))
    })
    return map
  })

  /** 当前子项的可用模型（取第一个成功项，供大屏 3D 场景） */
  const currentModel = computed<ModelInfo | null>(
    () => models.value.find((m) => m.status === 'success') ?? null,
  )

  async function fetchSubitems(): Promise<void> {
    loading.value = true
    try {
      subitems.value = await listAllSubitems()
      if (!currentSubitem.value && subitems.value.length > 0) {
        selectSubitem(subitems.value[0].id)
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载当前子项的测点（以 /points?subitem_id= 为准） */
  async function loadPoints(): Promise<void> {
    points.value = []
    const userStore = useUserStore()
    const id = currentSubitemId.value
    if (id == null || !userStore.token) return
    pointsLoading.value = true
    try {
      points.value = await listAllPoints({ subitem_id: id })
    } finally {
      pointsLoading.value = false
    }
  }

  /** 加载当前子项的传感器与通道，构建 channelPointMap（经 devices → points → sensors 串联） */
  async function loadChannels(): Promise<void> {
    const userStore = useUserStore()
    const id = currentSubitemId.value
    sensors.value = []
    channels.value = []
    channelPointMap.value = {}
    if (id == null || !userStore.token) return
    channelsLoading.value = true
    try {
      const devs = await listAllDevices(id)
      devices.value = devs

      const pointsOfDevices = await mapLimit(devs, 8, (d) => listAllPoints({ device_id: d.id }))
      const pts = pointsOfDevices.flat()

      const sensorsOfPoints = await mapLimit(pts, 8, (p) => listAllSensors(p.id))
      sensors.value = sensorsOfPoints.flat()

      const channelsOfSensors = await mapLimit(sensors.value, 8, (s) => listAllChannels(s.id))
      channels.value = channelsOfSensors.flat()

      const sensorToPoint = new Map(sensors.value.map((s) => [s.id, s.point_id]))
      const map: Record<number, number> = {}
      channels.value.forEach((c) => {
        const pointId = sensorToPoint.get(c.sensor_id)
        if (pointId != null) map[c.id] = pointId
      })
      channelPointMap.value = map
    } finally {
      channelsLoading.value = false
    }
  }

  async function loadModels(): Promise<void> {
    const id = currentSubitemId.value
    models.value = []
    if (id == null) return
    models.value = await listAllModels(id)
  }

  function selectSubitem(id: number): void {
    currentSubitemId.value = id
    localStorage.setItem(SUBITEM_KEY, String(id))
  }

  function selectChannel(id: number | null): void {
    selectedChannelId.value = id
  }

  /** 通道显示名：列表里没有的 id（WS 兜底发现）显示「通道 #id」 */
  function channelName(id: number): string {
    return channelMap.value.get(id)?.channel_code ?? `通道 #${id}`
  }

  // 子项切换：清空选中通道并重新加载层级数据与模型
  watch(
    currentSubitemId,
    () => {
      selectChannel(null)
      void loadPoints()
      void loadChannels()
      void loadModels()
    },
    { immediate: true },
  )

  return {
    subitems,
    currentSubitemId,
    currentSubitem,
    selectedChannelId,
    loading,
    devices,
    points,
    sensors,
    channels,
    models,
    currentModel,
    pointsLoading,
    channelsLoading,
    pointMap,
    channelMap,
    channelPointMap,
    channelIdsByPoint,
    fetchSubitems,
    loadPoints,
    loadChannels,
    loadModels,
    selectSubitem,
    selectChannel,
    channelName,
  }
})
