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
import { buildSensorVisuals } from '@/utils/three/sensorVisuals'
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

/** 视图切换按钮配置（中文标签 + tooltip） */
const VIEW_BUTTONS = [
  { dir: 'front' as const, label: '前', title: '前视图（沿 -Z 看）' },
  { dir: 'left' as const, label: '左', title: '左视图（沿 -X 看）' },
  { dir: 'top' as const, label: '俯', title: '俯视图（沿 +Y 看）' },
]

const containerRef = ref<HTMLDivElement>()
const modelLoading = ref(false)
const modelError = ref('')

// Three.js 对象不进入 Vue 响应式系统
let sceneManager: SceneManager | null = null
let pointManager: PointManager | null = null
let currentModel: THREE.Group | null = null
let raycaster: THREE.Raycaster | null = null
let clickHandler: ((event: MouseEvent) => void) | null = null
let storedMoveHandler: ((event: MouseEvent) => void) | null = null
let storedLeaveHandler: (() => void) | null = null

/**
 * 模型加载版本号：每次进入 loadModel 自增，用于识别"被新切换覆盖"的过期回调。
 * 在 fetch blob 与 GLTFLoader.parse 之间任一阶段被打断时，结果直接丢弃：
 * - 自创建的 objectURL 立即 revoke（避免旧的 blob 数据被新一次 fetch 释放）
 * - 不写 store ref，避免旧模型闪烁到新场景
 */
let loadGen = 0

/**
 * 模型文件接口需 JWT（非公开）：带 Authorization 的 blob 请求 → objectURL → GLTFLoader。
 * 拿到 objectURL 后立即 revoke，避免占用内存。
 */
async function loadModel(id: number | null): Promise<void> {
  if (!sceneManager) return
  const myGen = ++loadGen

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
    if (myGen !== loadGen) return // 被更新的切换覆盖，丢弃这次结果

    objectUrl = URL.createObjectURL(blob)
    if (myGen !== loadGen) {
      // 已经过期：URL 还没人用，立即 revoke
      URL.revokeObjectURL(objectUrl)
      return
    }

    const loader = new ModelLoader()
    const model = await loader.loadGLB(objectUrl)
    if (myGen !== loadGen) {
      // GLTFLoader 异步解析期间被覆盖，自己 add 前再确认一次
      URL.revokeObjectURL(objectUrl)
      return
    }

    currentModel = model
    applyWhiteMaterial(currentModel)
    sceneManager.getScene().add(currentModel)
    sceneManager.fitToModel(currentModel)
  } catch (err) {
    if (myGen === loadGen) {
      // 仅当这次仍是当前请求时，才向用户报错；过期请求吞掉
      // eslint-disable-next-line no-console
      console.error('[Scene3D] 模型加载失败:', err)
      modelError.value = '3D 模型加载失败，仅显示数据面板'
    }
  } finally {
    // 自己的 objectURL 总是 revoke，包括被覆盖的情况下
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    if (myGen === loadGen) modelLoading.value = false
  }
}

/** 把有坐标的传感器交给 PointManager（项目切换时 clear 后重新 init；pointId 即 sensor.id） */
function setupSensors(): void {
  if (!pointManager) return
  const visuals = buildSensorVisuals(
    dashboardStore.sensors,
    dashboardStore.channelIdsBySensor,
    wsStore.latestData,
  )
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

  // hover：随鼠标移动命中测点，调 PointManager.hoverPoint 视觉反馈 + cursor
  const moveHandler = (event: MouseEvent) => {
    if (!sceneManager || !pointManager || !raycaster) return
    const rect = dom.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, sceneManager.getCamera())
    const point = pointManager.getPointByRay(raycaster)
    const pid = point ? point.pointId : null
    pointManager.hoverPoint(pid)
    dom.style.cursor = pid != null ? 'pointer' : ''
  }
  // mouseleave 时取消 hover 高亮
  const leaveHandler = () => {
    pointManager?.hoverPoint(null)
    dom.style.cursor = ''
  }
  dom.addEventListener('mousemove', moveHandler)
  dom.addEventListener('mouseleave', leaveHandler)
  // 暴露给 onBeforeUnmount 清理
  storedMoveHandler = moveHandler
  storedLeaveHandler = leaveHandler
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
  const dom = sceneManager?.getRenderer().domElement
  if (dom) {
    if (clickHandler) dom.removeEventListener('click', clickHandler)
    if (storedMoveHandler) dom.removeEventListener('mousemove', storedMoveHandler)
    if (storedLeaveHandler) dom.removeEventListener('mouseleave', storedLeaveHandler)
  }
  clickHandler = null
  storedMoveHandler = null
  storedLeaveHandler = null
  pointManager?.clear()
  pointManager = null
  sceneManager?.stop()
  sceneManager = null
})

/** 视图切换按钮：摆正到前/左/俯三视图，保留当前 target 与距离 */
function setView(direction: 'front' | 'left' | 'top'): void {
  sceneManager?.setView(direction)
}

/** 给模型所有 mesh 换成白色 Lambert 材质，呈现"白模"风格 */
function applyWhiteMaterial(model: THREE.Object3D): void {
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false })
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.material = white
    }
  })
}
</script>

<template>
  <div ref="containerRef" v-loading="modelLoading" class="scene-container">
    <div v-if="modelError" class="model-tip">{{ modelError }}</div>
    <div class="view-controls" role="toolbar">
      <button
        v-for="v in VIEW_BUTTONS"
        :key="v.dir"
        type="button"
        :title="v.title"
        class="view-btn"
        @click="setView(v.dir)"
      >
        {{ v.label }}
      </button>
    </div>
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

.view-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10;
}

.view-btn {
  min-width: 32px;
  padding: 4px 8px;
  font-size: 12px;
  color: #d8e3f0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.35);
}

.view-btn:active {
  background: rgba(63, 231, 201, 0.2);
  border-color: #3de7c9;
}
</style>
