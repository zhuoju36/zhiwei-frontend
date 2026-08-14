<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { SceneManager } from '@/components/ThreeScene/SceneManager'
import { ModelLoader } from '@/components/ThreeScene/ModelLoader'
import { PointManager, type PointVisual } from '@/components/ThreeScene/PointManager'
import { getModelFileBlob } from '@/api/model'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { qualityToStatus } from '@/utils/color'
import type { PointStatus } from '@/types'

interface Props {
  /** 当前子项的成功模型 id；为空则不加载模型 */
  modelId?: number | null
}
const props = withDefaults(defineProps<Props>(), {
  modelId: null,
})

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

const containerRef = ref<HTMLDivElement>()
const modelLoading = ref(false)
const modelError = ref('')

// Three.js 对象不进入 Vue 响应式系统
let sceneManager: SceneManager | null = null
let pointManager: PointManager | null = null
let currentModel: THREE.Group | null = null
let raycaster: THREE.Raycaster | null = null
let clickHandler: ((event: MouseEvent) => void) | null = null

/**
 * 模型文件接口需 JWT（非公开）：带 Authorization 的 blob 请求 → objectURL → GLTFLoader。
 * 拿到 objectURL 后立即 revoke，避免占用内存。
 */
async function loadModel(id: number | null): Promise<void> {
  if (!sceneManager) return
  if (currentModel) {
    sceneManager.getScene().remove(currentModel)
    currentModel = null
  }
  modelError.value = ''
  if (id == null) return

  modelLoading.value = true
  let objectUrl: string | null = null
  try {
    const blob = await getModelFileBlob(id)
    objectUrl = URL.createObjectURL(blob)
    const loader = new ModelLoader()
    currentModel = await loader.loadGLB(objectUrl)
    sceneManager.getScene().add(currentModel)
  } catch {
    // 模型加载失败不阻塞数据面板
    modelError.value = '3D 模型加载失败，仅显示数据面板'
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    modelLoading.value = false
  }
}

/** 把有坐标的传感器交给 PointManager（项目切换时 clear 后重新 init；pointId 即 sensor.id） */
function setupSensors(): void {
  if (!pointManager) return
  const visuals: PointVisual[] = dashboardStore.sensors
    .filter((s) => s.position != null)
    .map((s) => {
      // 实时值按通道推送：该传感器任一通道的最新值（优先时间戳最新）
      let value = 0
      let status: PointStatus = 'normal'
      let latestTs = -1
      const channelIds = dashboardStore.channelIdsBySensor[s.id] ?? []
      channelIds.forEach((cid) => {
        const rt = wsStore.latestData[cid]
        if (!rt) return
        const ts = new Date(rt.timestamp).getTime()
        if (ts > latestTs) {
          latestTs = ts
          value = rt.value
          status = qualityToStatus(rt.quality)
        }
      })
      return {
        pointId: s.id,
        position: new THREE.Vector3(s.position!.x, s.position!.y, s.position!.z),
        status,
        value,
        name: s.sensor_name ?? s.sensor_code,
      }
    })
  pointManager.initPoints(visuals)
}

/** 射线检测：点击传感器选中其首个通道，与 PointPanel/底部曲线联动 */
function setupInteraction(): void {
  if (!sceneManager) return
  raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  const dom = sceneManager.getRenderer().domElement
  clickHandler = (event: MouseEvent) => {
    if (!sceneManager || !pointManager || !raycaster) return
    const rect = dom.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, sceneManager.getCamera())
    const point = pointManager.getPointByRay(raycaster)
    if (point) {
      const channelIds = dashboardStore.channelIdsBySensor[point.pointId] ?? []
      if (channelIds.length > 0) {
        dashboardStore.selectChannel(channelIds[0])
      }
    }
  }
  dom.addEventListener('click', clickHandler)
}

onMounted(() => {
  if (!containerRef.value) return
  sceneManager = new SceneManager(containerRef.value)
  sceneManager.start()
  pointManager = new PointManager(sceneManager.getScene())
  setupInteraction()
  setupSensors()
  void loadModel(props.modelId)
})

watch(
  () => props.modelId,
  (id) => void loadModel(id ?? null),
)

// 传感器列表加载/项目切换后重建测点渲染
watch(() => dashboardStore.sensors, setupSensors)

// WebSocket 实时数据 → 经 channelSensorMap 聚合到传感器 → 更新测点颜色
watch(
  () => wsStore.latestData,
  (dataMap) => {
    if (!pointManager) return
    const latestBySensor = new Map<number, { value: number; status: PointStatus; ts: number }>()
    Object.values(dataMap).forEach((p) => {
      const sensorId = dashboardStore.channelSensorMap[p.channel_id]
      if (sensorId == null) return
      const ts = new Date(p.timestamp).getTime()
      const cur = latestBySensor.get(sensorId)
      if (cur == null || ts > cur.ts) {
        latestBySensor.set(sensorId, { value: p.value, status: qualityToStatus(p.quality), ts })
      }
    })
    latestBySensor.forEach((v, sensorId) => {
      pointManager!.updatePoint(sensorId, v.value, v.status)
    })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (clickHandler && sceneManager) {
    sceneManager.getRenderer().domElement.removeEventListener('click', clickHandler)
    clickHandler = null
  }
  pointManager?.clear()
  pointManager = null
  sceneManager?.stop()
  sceneManager = null
})
</script>

<template>
  <div ref="containerRef" v-loading="modelLoading" class="scene-container">
    <div v-if="modelError" class="model-tip">{{ modelError }}</div>
  </div>
</template>

<style scoped lang="scss">
.scene-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.model-tip {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #e6a23c;
  background: rgba(0, 0, 0, 0.45);
}
</style>
