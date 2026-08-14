import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { listAllDevices } from '@/api/device'
import { listAllChannels } from '@/api/channel'
import { listAllModels } from '@/api/model'
import { listAllProjects } from '@/api/project'
import { listAllSensors } from '@/api/sensor'
import { useUserStore } from '@/stores/user'
import type { Channel, Device, ModelInfo, Project, Sensor } from '@/types'

const PROJECT_KEY = 'shm_current_project_id'
const LEGACY_SUBITEM_KEY = 'shm_current_subitem_id'

/** 读取持久化项目 id：优先新 key；旧 key（子项时代）存在时迁移 */
function readStoredProjectId(): number | null {
  let raw = localStorage.getItem(PROJECT_KEY)
  if (raw == null) {
    raw = localStorage.getItem(LEGACY_SUBITEM_KEY)
    if (raw != null) {
      localStorage.removeItem(LEGACY_SUBITEM_KEY)
      localStorage.setItem(PROJECT_KEY, raw)
    }
  }
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 有限并发执行：限制同时 in-flight 请求数，避免千级传感器一次性打满连接 */
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
  const projects = ref<Project[]>([])
  const storedId = readStoredProjectId()
  const currentProjectId = ref<number | null>(storedId)
  const selectedChannelId = ref<number | null>(null)
  const loading = ref(false)

  // 项目 → 设备 → 传感器 → 通道 全链路数据（供大屏/分析联动）
  const devices = ref<Device[]>([])
  const sensors = ref<Sensor[]>([])
  const channels = ref<Channel[]>([])
  const models = ref<ModelInfo[]>([])
  const channelsLoading = ref(false)

  /** channel_id → sensor_id（WS 实时数据按通道推送，3D 按传感器变色需反查） */
  const channelSensorMap = ref<Record<number, number>>({})

  const sensorMap = computed(() => new Map(sensors.value.map((s) => [s.id, s])))
  const channelMap = computed(() => new Map(channels.value.map((c) => [c.id, c])))
  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === currentProjectId.value) ?? null,
  )

  /** 传感器 → 其下通道 id 列表（3D 点击传感器选中首个通道） */
  const channelIdsBySensor = computed<Record<number, number[]>>(() => {
    const map: Record<number, number[]> = {}
    Object.entries(channelSensorMap.value).forEach(([channelId, sensorId]) => {
      const list = map[sensorId] ?? (map[sensorId] = [])
      list.push(Number(channelId))
    })
    return map
  })

  /** 当前项目的可用模型（取第一个成功项，供大屏 3D 场景） */
  const currentModel = computed<ModelInfo | null>(
    () => models.value.find((m) => m.status === 'success') ?? null,
  )

  async function fetchProjects(): Promise<void> {
    loading.value = true
    try {
      projects.value = await listAllProjects()
      if (!currentProject.value && projects.value.length > 0) {
        selectProject(projects.value[0].id)
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载当前项目的传感器与通道，构建 channelSensorMap（经 devices → sensors 串联） */
  async function loadChannels(): Promise<void> {
    const userStore = useUserStore()
    const id = currentProjectId.value
    sensors.value = []
    channels.value = []
    channelSensorMap.value = {}
    if (id == null || !userStore.token) return
    channelsLoading.value = true
    try {
      const devs = await listAllDevices(id)
      devices.value = devs

      const sensorsOfDevices = await mapLimit(devs, 8, (d) => listAllSensors(d.id))
      sensors.value = sensorsOfDevices.flat()

      const channelsOfSensors = await mapLimit(sensors.value, 8, (s) => listAllChannels(s.id))
      channels.value = channelsOfSensors.flat()

      const map: Record<number, number> = {}
      channels.value.forEach((c) => {
        map[c.id] = c.sensor_id
      })
      channelSensorMap.value = map
    } finally {
      channelsLoading.value = false
    }
  }

  async function loadModels(): Promise<void> {
    const id = currentProjectId.value
    models.value = []
    if (id == null) return
    models.value = await listAllModels(id)
  }

  function selectProject(id: number): void {
    currentProjectId.value = id
    localStorage.setItem(PROJECT_KEY, String(id))
  }

  function selectChannel(id: number | null): void {
    selectedChannelId.value = id
  }

  /** 通道显示名：列表里没有的 id（WS 兜底发现）显示「通道 #id」 */
  function channelName(id: number): string {
    return channelMap.value.get(id)?.channel_code ?? `通道 #${id}`
  }

  // 项目切换：清空选中通道并重新加载层级数据与模型
  watch(
    currentProjectId,
    () => {
      selectChannel(null)
      void loadChannels()
      void loadModels()
    },
    { immediate: true },
  )

  return {
    projects,
    currentProjectId,
    currentProject,
    selectedChannelId,
    loading,
    devices,
    sensors,
    channels,
    models,
    currentModel,
    channelsLoading,
    sensorMap,
    channelMap,
    channelSensorMap,
    channelIdsBySensor,
    fetchProjects,
    loadChannels,
    loadModels,
    selectProject,
    selectChannel,
    channelName,
  }
})
