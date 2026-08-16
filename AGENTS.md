# AGENTS.md - 前端开发规范与指南

> **项目**：止危结构健康监测（SHM）平台前端  
> **技术栈**：Vue 3.4 + Vite 5 + TypeScript 5.3 + Element Plus 2.7 + Three.js r160 + ECharts 5 + Pinia 2  
> **核心约束**：**1000+ 测点实时渲染**、**WebSocket 高频数据流**、**IFC/OBJ 模型加载与测点绑定**
> 全局文档见 ../shm-docs/

---

## 0. 基本开发原则

### 0.1 基本原则
- 当前系统还在早期开发阶段，未上线，不需要考虑向后兼容。
- 优先使用能满足当前需求的最简单实现。不要预防性抽象，不要多此一举的配置层。
- 系统分层生长。先跑通一个最小的端到端版本，再往上加东西。绝不为了未完成的复杂度拆掉能跑的东西。
- 组件保持模块化，关注点分离。
- 优先使用成熟的、有人维护的库。没有明确理由不要自己重写。
- 先翻项目里已有的依赖能做什么，再考虑加新包或者自己写。
- 架构决策要有长远眼光。不接受“先这样以后再换”的临时方案。
- 先看成熟产品怎么解决同一个问题，用已验证的模式，不要从零发明。


## 1. 项目结构（必须严格遵守）

```
frontend/
+-- public/
|   +-- models/                 # 预置 3D 模型（仅开发测试用，生产走 MinIO CDN）
|
+-- src/
|   +-- main.ts                 # 应用入口：创建 App、注册插件、挂载
|   +-- App.vue                 # 根组件：路由视图 + 全局异常边界
|   +-- vite-env.d.ts           # Vite 客户端类型声明
|   |
|   +-- router/
|   |   +-- index.ts            # 路由表 + 导航守卫 + 权限拦截
|   |   +-- routes.ts           # 路由配置数组，按模块分组
|   |
|   +-- stores/                 # Pinia 状态管理，一模块一文件
|   |   +-- index.ts            # Pinia 实例导出
|   |   +-- user.ts             # 用户状态：token、角色
|   |   +-- websocket.ts        # WebSocket 连接管理：自动重连、消息分发、data:alert
|   |   +-- dashboard.ts        # 大屏数据缓存：项目/设备/传感器/通道、channelSensorMap、统计卡片
|   |   +-- app.ts              # 全局 UI 状态：侧边栏折叠、主题、加载状态
|   |
|   +-- api/                    # API 接口封装
|   |   +-- request.ts          # Axios 实例：拦截器（信封解包）、错误处理、Token 刷新
|   |   +-- types.ts            # 通用 API 响应类型定义（Envelope / PageData）
|   |   +-- pager.ts            # 分页拉全辅助（fetchAllPages）
|   |   +-- auth.ts
|   |   +-- project.ts          # 项目 CRUD + 用户授权
|   |   +-- user.ts
|   |   +-- device.ts
|   |   +-- sensor.ts
|   |   +-- channel.ts
|   |   +-- data.ts             # 时序数据查询（channel_id）
|   |   +-- alert.ts
|   |   +-- analysis.ts         # FFT 分析任务 + NPZ 结果下载
|   |   +-- dashboard.ts        # 大屏统计
|   |   +-- protocol.ts
|   |   +-- model.ts            # 3D 模型文件操作（上传/GLB blob 下载）
|   |   +-- platform.ts
|   |   +-- setup.ts
|   |
|   +-- views/                  # 页面级组件，与路由一一对应
|   |   +-- Login.vue           # 登录页（独立布局，无侧边栏）
|   |   +-- Dashboard/          # 数据大屏（核心页面）
|   |   |   +-- Index.vue       # 布局容器：统计卡片 + 3D 场景 + 侧边通道面板 + 底部图表面板
|   |   |   +-- Scene3D.vue     # Three.js 场景封装（模型鉴权下载 + channelSensorMap 实时变色）
|   |   |   +-- PointPanel.vue  # 通道列表侧边面板（channel_code + 最新值 + 状态色）
|   |   |   +-- ChartStrip.vue  # 底部实时曲线条带
|   |   +-- Analysis/           # 数据分析
|   |   |   +-- Index.vue
|   |   |   +-- RealTime.vue    # 实时监测：多通道并行曲线
|   |   |   +-- History.vue     # 历史查询：时间范围选择 + 聚合间隔 + 导出
|   |   |   +-- Spectrum.vue    # 频谱分析：FFT 任务 + NPZ 解析 + 结果摘要回退
|   |   |   +-- AlertLog.vue    # 预警日志：/alerts 列表 + 确认处理
|   |   +-- Admin/              # 管理后台
|   |       +-- ProjectManage.vue  # 项目管理：CRUD + 授权对话框
|   |       +-- DeviceManage.vue   # 设备管理：协议下拉取 /protocols
|   |       +-- SensorManage.vue   # 传感器管理：项目→设备→传感器级联（含位置）
|   |       +-- ChannelManage.vue  # 通道管理：项目→设备→传感器级联 + alert_rules JSON 编辑
|   |       +-- UserManage.vue     # 用户管理：CRUD + 重置密码
|   |       +-- PluginManage.vue   # 协议适配器 + 分析插件说明
|   |       +-- LogManage.vue      # 日志管理（占位）
|   |
|   +-- components/             # 可复用业务组件（非页面级）
|   |   +-- ThreeScene/         # Three.js 核心封装（与技术无关的纯 3D 逻辑）
|   |   |   +-- index.vue         # 场景容器组件：canvas + 加载状态 + 错误边界
|   |   |   +-- SceneManager.ts   # 场景管理器：初始化、渲染循环、资源释放
|   |   |   +-- ModelLoader.ts    # 模型加载：GLB/GLTF/OBJ 统一封装
|   |   |   +-- PointManager.ts   # 测点管理：创建、更新、高亮、隐藏
|   |   |   +-- Interaction.ts    # 射线检测：点击/悬停测点、相机控制
|   |   |   +-- AnimationLoop.ts  # 动画循环：独立于 Vue 响应式，避免性能损耗
|   |   +-- Charts/
|   |   |   +-- TimeSeries.vue    # 时序曲线封装（ECharts）
|   |   |   +-- SpectrumChart.vue # 频谱图封装
|   |   |   +-- GaugeChart.vue    # 仪表盘（单测点实时值）
|   |   +-- Common/
|   |   |   +-- AppHeader.vue
|   |   |   +-- AppSidebar.vue
|   |   |   +-- DataTable.vue     # 通用表格：分页 + 排序 + 筛选封装
|   |   |   +-- PermissionWrapper.vue # 权限控制渲染包装器
|   |   +-- Form/
|   |       +-- CoordinatePicker.vue  # 三维坐标输入（X/Y/Z）
|   |
|   +-- composables/            # 组合式函数（Vue 3 Composition API 最佳实践）
|   |   +-- useAuth.ts          # 认证逻辑：登录、登出、Token 刷新
|   |   +-- useWebSocket.ts     # WebSocket 封装：连接、订阅、消息处理
|   |   +-- useThreeScene.ts    # Three.js 场景生命周期管理
|   |   +-- useTimeSeries.ts    # 时序数据获取 + 自动刷新
|   |   +-- usePermission.ts    # 权限检查：角色、项目访问权
|   |
|   +-- types/                  # 全局 TypeScript 类型定义
|   |   +-- index.ts            # 统一导出
|   |   +-- user.ts
|   |   +-- project.ts          # Project, ProjectLocation
|   |   +-- device.ts           # Device, DeviceStatus
|   |   +-- sensor.ts           # Sensor, Position3D（position 并入 sensor）
|   |   +-- channel.ts          # Channel, AlertRule
|   |   +-- alert.ts            # Alert, AlertLevel
|   |   +-- analysis.ts         # AnalysisJob, JobStatus, ResultSummary, SpectrumData
|   |   +-- model.ts            # ModelInfo, ModelStatus
|   |   +-- platform.ts         # PlatformInfo
|   |   +-- protocol.ts         # ProtocolInfo
|   |   +-- setup.ts            # SetupStatus, InitAdminResponse
|   |   +-- data.ts             # TimeSeriesItem, TimeseriesResponse, LatestValue, WsMessage
|   |
|   +-- utils/                  # 纯工具函数，无 Vue 依赖
|   |   +-- auth.ts             # JWT 解析、过期检查
|   |   +-- format.ts           # 数值格式化、时间格式化、单位换算
|   |   +-- color.ts            # 状态颜色映射：normal/warning/danger
|   |   +-- npy.ts              # 轻量 NPY 读取器（float64/float32 一维，FFT 频谱解析）
|   |
|   +-- assets/                 # 静态资源
|   |   +-- styles/
|   |   |   +-- variables.scss  # Element Plus 主题变量覆盖
|   |   |   +-- global.scss     # 全局样式、滚动条、字体
|   |   +-- icons/              # SVG 图标（未经 Iconify 的自定义图标）
|   |
|   +-- plugins/                # Vue 插件注册
|       +-- element-plus.ts     # Element Plus 按需/全量注册 + 中文语言包
|       +-- echarts.ts          # ECharts 按需引入 + 主题注册
|
+-- tests/                      # 测试目录
|   +-- unit/
|   |   +-- utils/              # 工具函数单元测试
|   |   +-- components/         # 组件测试（Vue Test Utils）
|   +-- e2e/                    # 端到端测试（Playwright）
|
+-- .env                        # 环境变量（开发）
+-- .env.production             # 环境变量（生产）
+-- vite.config.ts
+-- tsconfig.json
+-- eslint.config.js            # ESLint 9 flat config
+-- tailwind.config.js          # 如使用 Tailwind（可选）
+-- Dockerfile
```

---

## 2. 编码规范

### 2.1 Vue 3 与 TypeScript

- **必须使用 `<script setup lang="ts">`**，禁止 Options API
- **Props 定义**：使用 `defineProps<T>()` 配合接口，禁止 `defineProps({})` 无类型形式
- **Emits 定义**：使用 `defineEmits<T>()` 类型安全
- **组件名**：PascalCase，多单词（如 `PointPanel.vue`），禁止单单词（除根组件外）
- **文件路径别名**：`@/` 指向 `src/`，禁止相对路径超过两层（`../../`）

```vue
<!-- 正确示例 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Point } from '@/types'

interface Props {
  point: Point
  showLabel?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  showLabel: true
})

const emit = defineEmits<{
  select: [pointId: number]
  hover: [pointId: number | null]
}>()

const statusColor = computed(() => {
  const map = { normal: '#67C23A', warning: '#E6A23C', danger: '#F56C6C' }
  return map[props.point.status] || '#909399'
})
</script>
```

### 2.2 状态管理（Pinia）

- **Store 必须是函数式定义**（Setup Store），禁止 Option Store
- **Store 职责单一**：`user.ts` 只存用户相关，`websocket.ts` 只管连接
- **禁止在 Store 中直接操作 DOM 或引入 Three.js 对象**

```typescript
// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { DataMessage, AlertMessage } from '@/types'

export const useWebSocketStore = defineStore('websocket', () => {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const latestData = ref<Record<number, DataMessage>>({})
  const unreadAlerts = ref<AlertMessage[]>([])
  const currentProjectId = ref<number | null>(null)

  // 只暴露必要的状态，内部逻辑封装
  const connect = (token: string, projectId: number) => { /* ... */ }
  const disconnect = () => { /* ... */ }
  const subscribeProject = (projectId: number) => { /* ... */ }

  return {
    isConnected: readonly(isConnected),
    latestData: readonly(latestData),
    unreadAlerts,
    currentProjectId,
    connect,
    disconnect,
    subscribeProject,
  }
})
```

### 2.3 API 请求封装

```typescript
// api/request.ts
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

// 请求拦截：注入 Token
request.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

// 响应拦截：统一错误处理 + Token 刷新
request.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    if (err.response?.status === 401) {
      // 尝试刷新 Token，失败则跳转登录
      const userStore = useUserStore()
      const refreshed = await userStore.refreshToken()
      if (!refreshed) {
        window.location.href = '/login'
        return Promise.reject(err)
      }
      // 重试原请求
      err.config.headers.Authorization = `Bearer ${userStore.token}`
      return request(err.config)
    }
    ElMessage.error(err.response?.data?.message || '网络错误')
    return Promise.reject(err)
  }
)

export default request
```

---

## 3. Three.js 开发规范（核心）

### 3.1 架构原则

- **Three.js 对象禁止直接暴露在 Vue 响应式系统中**（会导致严重性能问题）
- 使用 **纯 TypeScript 类** 封装 Three.js 逻辑，Vue 组件仅作为容器和事件桥接
- 动画循环使用 `requestAnimationFrame`，**独立于 Vue 的更新周期**

### 3.2 场景管理器（SceneManager）

```typescript
// components/ThreeScene/SceneManager.ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private animationId: number = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(private container: HTMLElement) {
    // 初始化场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // 相机
    const { clientWidth, clientHeight } = container
    this.camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 1000)
    this.camera.position.set(20, 20, 20)

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(clientWidth, clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)

    // 控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05

    // 灯光
    this.setupLights()

    // 响应式
    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(container)
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(10, 20, 10)
    this.scene.add(directional)
  }

  start() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  stop() {
    cancelAnimationFrame(this.animationId)
    this.resizeObserver?.disconnect()
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  private onResize() {
    const { clientWidth, clientHeight } = this.container
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight)
  }

  getScene() { return this.scene }
  getCamera() { return this.camera }
  getRenderer() { return this.renderer }
  getControls() { return this.controls }
}
```

### 3.3 测点管理器（PointManager）- 1000+ 测点优化

**核心挑战**：1000 个测点如果每个都是独立 Mesh，帧率会暴跌。必须使用 **InstancedMesh** 或 **合并几何体**。

```typescript
// components/ThreeScene/PointManager.ts
import * as THREE from 'three'

export interface PointVisual {
  pointId: number
  position: THREE.Vector3
  status: 'normal' | 'warning' | 'danger'
  value: number
  name: string
}

export class PointManager {
  private scene: THREE.Scene
  private pointMap = new Map<number, PointVisual>()
  private instanceMesh: THREE.InstancedMesh | null = null
  private dummy = new THREE.Object3D()
  private colorNormal = new THREE.Color(0x67C23A)
  private colorWarning = new THREE.Color(0xE6A23C)
  private colorDanger = new THREE.Color(0xF56C6C)
  private raycastTargets: THREE.Mesh[] = []  // 用于射线检测的代理 Mesh

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /** 批量初始化测点（页面加载时一次性调用） */
  initPoints(points: PointVisual[]) {
    // 清理旧数据
    this.clear()

    const geometry = new THREE.SphereGeometry(0.15, 8, 8)  // 低面数球体
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff })

    this.instanceMesh = new THREE.InstancedMesh(geometry, material, points.length)
    this.instanceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.instanceMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(points.length * 3), 3
    )

    points.forEach((p, i) => {
      this.pointMap.set(p.pointId, p)

      // 设置位置
      this.dummy.position.copy(p.position)
      this.dummy.updateMatrix()
      this.instanceMesh!.setMatrixAt(i, this.dummy.matrix)

      // 设置颜色
      this.instanceMesh!.setColorAt(i, this.getColor(p.status))

      // 创建不可见的射线检测代理（InstancedMesh 本身射线检测性能差）
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 4, 4),  // 稍大，方便点击
        new THREE.MeshBasicMaterial({ visible: false })
      )
      proxy.position.copy(p.position)
      proxy.userData = { pointId: p.pointId, index: i }
      this.scene.add(proxy)
      this.raycastTargets.push(proxy)
    })

    this.instanceMesh.instanceMatrix.needsUpdate = true
    if (this.instanceMesh.instanceColor) {
      this.instanceMesh.instanceColor.needsUpdate = true
    }
    this.scene.add(this.instanceMesh)
  }

  /** 更新单个测点状态（WebSocket 实时数据触发） */
  updatePoint(pointId: number, value: number, status: 'normal' | 'warning' | 'danger') {
    const point = this.pointMap.get(pointId)
    if (!point || !this.instanceMesh) return

    point.value = value
    point.status = status

    // 找到 index 并更新颜色
    const index = Array.from(this.pointMap.keys()).indexOf(pointId)
    this.instanceMesh.setColorAt(index, this.getColor(status))
    this.instanceMesh.instanceColor!.needsUpdate = true
  }

  /** 高亮测点（用户点击/悬停） */
  highlightPoint(pointId: number | null) {
    // 可通过额外的一个 InstancedMesh 或 Sprite 实现高亮环
    // 避免修改原 instanceMesh 的矩阵
  }

  getPointByRay(raycaster: THREE.Raycaster): PointVisual | null {
    const intersects = raycaster.intersectObjects(this.raycastTargets)
    if (intersects.length === 0) return null
    const pid = intersects[0].object.userData.pointId as number
    return this.pointMap.get(pid) || null
  }

  private getColor(status: string): THREE.Color {
    switch (status) {
      case 'warning': return this.colorWarning
      case 'danger': return this.colorDanger
      default: return this.colorNormal
    }
  }

  clear() {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh)
      this.instanceMesh.dispose()
      this.instanceMesh = null
    }
    this.raycastTargets.forEach(m => this.scene.remove(m))
    this.raycastTargets = []
    this.pointMap.clear()
  }
}
```

### 3.4 模型加载策略

```typescript
// components/ThreeScene/ModelLoader.ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export class ModelLoader {
  private gltfLoader: GLTFLoader
  private objLoader: OBJLoader

  constructor() {
    this.gltfLoader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')  // 静态资源路径
    this.gltfLoader.setDRACOLoader(dracoLoader)

    this.objLoader = new OBJLoader()
  }

  async loadGLB(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => {
        const model = gltf.scene
        // 遍历并提取 userData 中的构件信息
        model.traverse((child) => {
          if (child.isMesh) {
            child.userData.ifcGuid = child.userData.ifc_guid || null
            child.userData.pointIds = child.userData.point_ids || []
          }
        })
        resolve(model)
      }, undefined, reject)
    })
  }

  async loadOBJ(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.objLoader.load(url, (group) => {
        // OBJ 无 userData，需外部传入映射
        resolve(group)
      }, undefined, reject)
    })
  }
}
```

### 3.5 Vue 组件集成

```vue
<!-- views/Dashboard/Scene3D.vue -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { SceneManager } from '@/components/ThreeScene/SceneManager'
import { PointManager } from '@/components/ThreeScene/PointManager'
import { ModelLoader } from '@/components/ThreeScene/ModelLoader'
import { useWebSocketStore } from '@/stores/websocket'
import type { PointVisual } from '@/types'

const containerRef = ref<HTMLDivElement>()
const sceneManager = ref<SceneManager>()
const pointManager = ref<PointManager>()
const wsStore = useWebSocketStore()

// 监听 WebSocket 实时数据，更新测点颜色
watch(() => wsStore.latestData, (dataMap) => {
  if (!pointManager.value) return
  Object.values(dataMap).forEach((msg: any) => {
    pointManager.value!.updatePoint(msg.point_id, msg.value, msg.status)
  })
}, { deep: true })

onMounted(async () => {
  if (!containerRef.value) return

  // 1. 初始化场景
  const sm = new SceneManager(containerRef.value)
  sceneManager.value = sm
  sm.start()

  // 2. 加载模型
  const loader = new ModelLoader()
  const model = await loader.loadGLB('/api/v1/models/1/building.glb')
  sm.getScene().add(model)

  // 3. 初始化测点（从 API 获取测点列表 + 坐标）
  const pm = new PointManager(sm.getScene())
  pointManager.value = pm
  // pointsData 从父组件 props 或 API 获取
  // pm.initPoints(pointsData.value)

  // 4. 绑定交互
  setupInteraction(sm, pm)
})

onBeforeUnmount(() => {
  pointManager.value?.clear()
  sceneManager.value?.stop()
})

function setupInteraction(sm: SceneManager, pm: PointManager) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  sm.getRenderer().domElement.addEventListener('click', (event) => {
    const rect = sm.getRenderer().domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, sm.getCamera())
    const point = pm.getPointByRay(raycaster)
    if (point) {
      // emit('select-point', point.pointId)
    }
  })
}
</script>

<template>
  <div ref="containerRef" class="scene-container" />
</template>

<style scoped>
.scene-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
```

---

## 4. WebSocket 开发规范

### 4.1 连接管理（composables/useWebSocket.ts）

```typescript
import { ref, readonly } from 'vue'
import { useUserStore } from '@/stores/user'

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'wss://localhost/ws'

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const reconnectCount = ref(0)
  const MAX_RECONNECT = 5
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = () => {
    const userStore = useUserStore()
    if (!userStore.token) return

    const url = `${WS_BASE_URL}/data?token=${userStore.token}`
    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      isConnected.value = true
      reconnectCount.value = 0
      startHeartbeat()
    }

    ws.value.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleMessage(message)
    }

    ws.value.onclose = () => {
      isConnected.value = false
      stopHeartbeat()
      if (reconnectCount.value < MAX_RECONNECT) {
        reconnectTimer = setTimeout(() => {
          reconnectCount.value++
          connect()
        }, 3000 * reconnectCount.value)  // 退避重连
      }
    }

    ws.value.onerror = (err) => {
      console.error('WebSocket error:', err)
      ws.value?.close()
    }
  }

  const disconnect = () => {
    stopHeartbeat()
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws.value?.close()
    ws.value = null
  }

  const startHeartbeat = () => {
    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  }

  const subscribeProject = (projectId: number) => {
    send({ type: 'cmd:subscribe', project_id: projectId })
  }

  const send = (data: object) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    }
  }

  // 消息分发：通过 Pinia store 或 EventBus 解耦
  // 注意：后端无心跳/pong，不发送 ping
  const handleMessage = (msg: any) => {
    switch (msg.type) {
      case 'data:realtime':
        // 更新 dashboard store（payload: channel_id/device_code/channel_code/value/unit/quality/timestamp）
        break
      case 'data:alert':
        // 活跃告警列表 + ElNotification（payload 含 status: triggered|updated|resolved）
        break
      case 'cmd:subscribed':
        // 记录当前订阅 project_id
        break
      case 'cmd:error':
        // 订阅被拒绝（如 FORBIDDEN），连接保持打开
        break
    }
  }

  return {
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    subscribeProject,
    send,
  }
}
```

### 4.2 与 Pinia 集成

```typescript
// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

export const useWebSocketStore = defineStore('websocket', () => {
  const { connect, disconnect, subscribeProject, isConnected } = useWebSocket()
  const latestData = ref<Record<number, any>>({})
  const alerts = ref<any[]>([])

  // 暴露给组件的只读状态
  return {
    isConnected: readonly(isConnected),
    latestData: readonly(latestData),
    alerts: readonly(alerts),
    connect,
    disconnect,
    subscribeProject,
  }
})
```

---

## 5. 数据分析页面规范

### 5.1 时序曲线组件（TimeSeries.vue）

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, DataZoomComponent])

interface Props {
  pointIds: number[]
  startTime: string
  endTime: string
  interval: string  // 1s, 1m, 1h
}
const props = defineProps<Props>()

const chartOption = ref({})
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  // 并行请求多个测点
  const results = await Promise.all(
    props.pointIds.map(id => 
      api.data.getTimeseries({ point_id: id, start: props.startTime, end: props.endTime, interval: props.interval })
    )
  )
  // 组装 ECharts option
  // chartOption.value = buildChartOption(results)
  loading.value = false
}

watch(() => [props.startTime, props.endTime, props.interval], fetchData, { immediate: true })
</script>

<template>
  <v-chart class="chart" :option="chartOption" autoresize v-loading="loading" />
</template>
```

### 5.2 性能优化

- **数据量控制**：单次查询返回点数不超过 5000，超出时后端自动降采样
- **图表销毁**：页面切换时调用 `echarts.dispose()`，避免内存泄漏
- **虚拟滚动**：历史数据表格使用 `el-table` 的虚拟滚动或 `vxe-table`

---

## 6. 权限与路由

### 6.1 路由元信息

```typescript
// router/routes.ts
import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard/Index.vue'),
    meta: { requiresAuth: true, title: '数据大屏' }
  },
  {
    path: '/analysis',
    component: () => import('@/views/Analysis/Index.vue'),
    meta: { requiresAuth: true, title: '数据分析' }
  },
  {
    path: '/admin',
    component: () => import('@/views/Admin/Index.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '管理后台' },
    children: [
      { path: 'users', component: () => import('@/views/Admin/UserManage.vue') },
      { path: 'devices', component: () => import('@/views/Admin/DeviceManage.vue') },
      { path: 'projects', component: () => import('@/views/Admin/ProjectManage.vue') },
    ]
  },
]
```

### 6.2 导航守卫

```typescript
// router/index.ts
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.token) {
    next('/login')
    return
  }

  if (to.meta.requiresAdmin && userStore.role !== 'admin') {
    next('/403')
    return
  }

  next()
})
```

### 6.3 组件级权限

```vue
<!-- components/Common/PermissionWrapper.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  role?: string        // 'admin' | 'user'
  projectId?: number   // 检查用户是否有该项目权限
}>()

const userStore = useUserStore()
const hasPermission = computed(() => {
  if (props.role && userStore.role !== props.role) return false
  // 项目权限列表由后端校验，前端仅提示
  return true
})
</script>

<template>
  <slot v-if="hasPermission" />
  <slot v-else name="fallback">
    <el-empty description="无权限访问" />
  </slot>
</template>
```

---

## 7. 构建与部署

### 7.1 Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 7.2 Nginx 配置要点

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # 前端路由 history 模式支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://api:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://api:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 3D 模型文件大文件传输
    location /api/v1/models/ {
        proxy_pass http://api:8000/api/v1/models/;
        proxy_buffering off;
        proxy_max_temp_file_size 0;
    }
}
```

---

## 8. 常见反模式（禁止清单）

| 反模式 | 后果 | 正确做法 |
|--------|------|----------|
| Three.js 对象放入 Vue `ref`/`reactive` | 严重性能损耗，帧率暴跌 | 使用纯 TS 类管理，Vue 仅持有管理器引用 |
| 在 `requestAnimationFrame` 中读取 Vue 响应式状态 | 触发大量依赖追踪 | 将数据抽离到普通对象，每帧手动同步 |
| WebSocket 消息直接修改组件局部状态 | 跨组件数据不同步 | 统一写入 Pinia Store，组件读取 Store |
| 1000 个测点用 1000 个独立 Mesh | 渲染卡顿（< 10 FPS） | 使用 `InstancedMesh` 批量渲染 |
| 同时加载多个大型 3D 模型 | 内存溢出、页面卡死 | 按需加载、Draco 压缩、LOD 策略 |
| 在模板中直接调用 API | 难以复用、测试困难 | 封装到 composable 或 store action |
| 忽略 ECharts 实例销毁 | 内存泄漏，页面切换后图表残留 | `onBeforeUnmount` 中调用 `dispose()` |
| 使用 `v-if` 频繁切换 Three.js 容器 | 场景反复重建，资源泄漏 | 使用 `v-show` 或手动控制可见性 |
| 前端直接解析 IFC 文件 | 文件大时主线程阻塞数秒 | 后端预转换为 GLB，前端只加载 GLB |
| 忽略 TypeScript `strict` 模式 | 运行时类型错误频发 | `tsconfig.json` 开启 `strict: true` |
