import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface SceneManagerOptions {
  /** 是否启用 OrbitControls 阻尼（默认 false：鼠标释放即停） */
  enableDamping?: boolean
}

/**
 * 场景管理器：初始化、渲染循环、资源释放。
 * 纯 TS 类，Three.js 对象不进入 Vue 响应式系统。
 */
export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private animationId = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(private container: HTMLElement, options: SceneManagerOptions = {}) {
    // 场景
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

    // 控制器：默认无阻尼，鼠标释放即停
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = options.enableDamping ?? false
    if (this.controls.enableDamping) {
      this.controls.dampingFactor = 0.05
    }

    // 灯光
    this.setupLights()

    // 辅助网格，空场景时不至于迷失方向
    const grid = new THREE.GridHelper(40, 40, 0x334466, 0x223355)
    this.scene.add(grid)

    // 容器尺寸响应
    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(container)
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(10, 20, 10)
    this.scene.add(directional)
  }

  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  stop(): void {
    cancelAnimationFrame(this.animationId)
    this.resizeObserver?.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  private onResize(): void {
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight)
  }

  /**
   * 把相机和 OrbitControls.target 适配到指定对象的包围盒。
   * 保留当前视角方向（不强制正轴），只调整距离与中心，使模型恰好填满视口
   * 并留出 padding 比例的呼吸空间。
   */
  fitToModel(obj: THREE.Object3D, padding = 0.2): void {
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // 取最长边作为"包围球半径"参考，保证最坏方向也不被裁切
    const radius = Math.max(size.x, size.y, size.z) / 2

    // 透视相机半角正切：让模型直径恰好等于视口高度（取 fov 较小的那条）
    const fovV = (this.camera.fov * Math.PI) / 180
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect)
    const fovMin = Math.min(fovV, fovH)
    const distance = radius / Math.tan(fovMin / 2) * (1 + padding)

    // 沿用当前视角方向；若方向接近零（target 与 camera 重合），用默认斜角
    const currentDir = this.camera.position.clone().sub(this.controls.target)
    const dir =
      currentDir.length() > 0.001
        ? currentDir.normalize()
        : new THREE.Vector3(1, 1, 1).normalize()

    this.controls.target.copy(center)
    this.camera.position.copy(center).add(dir.multiplyScalar(distance))
    this.camera.near = Math.max(0.01, distance / 1000)
    this.camera.far = distance * 100
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(center)
    this.controls.update()
  }

  /**
   * 把相机摆到正交标准视图方向（沿用当前 target 与距离，保留缩放）。
   *  - front：沿 -Z 看 +Y up（相机在 (0, 0, +dist)，target 中心）
   *  - left ：沿 -X 看 +Y up（相机在 (-dist, 0, 0)，target 中心）
   *  - top  ：沿 +Y 看 -Z 方向（相机在 (0, +dist, 0)，target 中心）
   * 调用 fitToModel 之后再切换最稳。
   */
  setView(direction: 'front' | 'left' | 'top'): void {
    const target = this.controls.target.clone()
    const dist = this.camera.position.distanceTo(target)
    if (dist < 0.001) return

    const offset =
      direction === 'front'
        ? new THREE.Vector3(0, 0, dist)
        : direction === 'left'
          ? new THREE.Vector3(-dist, 0, 0)
          : new THREE.Vector3(0, dist, 0)

    this.controls.target.copy(target)
    this.camera.position.copy(target).add(offset)
    this.camera.lookAt(target)
    this.controls.update()
  }

  getScene(): THREE.Scene {
    return this.scene
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  getControls(): OrbitControls {
    return this.controls
  }
}
