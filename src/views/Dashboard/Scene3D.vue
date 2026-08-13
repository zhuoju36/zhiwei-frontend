<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { SceneManager } from '@/components/ThreeScene/SceneManager'
import { ModelLoader } from '@/components/ThreeScene/ModelLoader'
import { PointManager, type PointVisual } from '@/components/ThreeScene/PointManager'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { qualityToStatus } from '@/utils/color'

interface Props {
  /** 项目的模型文件 key；为空则不加载模型 */
  modelFileKey?: string | null
}
const props = withDefaults(defineProps<Props>(), {
  modelFileKey: null,
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

async function loadModel(key: string | null): Promise<void> {
  if (!sceneManager) return
  if (currentModel) {
    sceneManager.getScene().remove(currentModel)
    currentModel = null
  }
  modelError.value = ''
  if (!key) return

  modelLoading.value = true
  try {
    const loader = new ModelLoader()
    // 开发期兜底 public/models/ 静态目录
    currentModel = await loader.loadGLB(`/models/${key}`)
    sceneManager.getScene().add(currentModel)
  } catch {
    // 模型加载失败不阻塞数据面板
    modelError.value = '3D 模型加载失败，仅显示数据面板'
  } finally {
    modelLoading.value = false
  }
}

/** 把有坐标的测点交给 PointManager（项目切换时 clear 后重新 init） */
function setupPoints(): void {
  if (!pointManager) return
  const visuals: PointVisual[] = dashboardStore.points
    .filter((p) => p.position != null)
    .map((p) => {
      const rt = wsStore.latestData[p.id]
      return {
        pointId: p.id,
        position: new THREE.Vector3(p.position!.x, p.position!.y, p.position!.z),
        status: rt ? qualityToStatus(rt.quality) : 'normal',
        value: rt?.value ?? 0,
        name: p.point_name,
      }
    })
  pointManager.initPoints(visuals)
}

/** 射线检测：点击测点与 PointPanel/底部曲线联动 */
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
      dashboardStore.selectPoint(point.pointId)
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
  setupPoints()
  void loadModel(props.modelFileKey)
})

watch(
  () => props.modelFileKey,
  (key) => void loadModel(key ?? null),
)

// 测点列表加载/项目切换后重建测点渲染
watch(() => dashboardStore.points, setupPoints)

// WebSocket 实时数据 → 更新测点颜色
watch(
  () => wsStore.latestData,
  (dataMap) => {
    if (!pointManager) return
    Object.values(dataMap).forEach((p) => {
      pointManager!.updatePoint(p.point_id, p.value, qualityToStatus(p.quality))
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
  width: 100%;
  height: 100%;
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
