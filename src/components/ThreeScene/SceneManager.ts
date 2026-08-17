import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface SceneManagerOptions {
  /** 是否启用 OrbitControls 阻尼（默认 false：鼠标释放即停） */
  enableDamping?: boolean
}

/** 在 canvas 上绘制一个 X/Y/Z 文字标签，返回 Sprite 用的 texture */
function makeAxisLabel(text: string, color: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.font = 'bold 40px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 描边 + 填充，确保任意背景下可读
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(text, 32, 32)
  ctx.fillStyle = color
  ctx.fillText(text, 32, 32)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  return tex
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

  // 坐标系 gizmo（独立 mini scene + ortho camera，渲染到主画布左上角）
  private gizmoScene: THREE.Scene
  private gizmoCamera: THREE.OrthographicCamera
  private gizmoGroup: THREE.Group

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

    // gizmo：mini scene + ortho camera，跟随主相机旋转
    this.gizmoScene = new THREE.Scene()
    this.gizmoCamera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 10)
    this.gizmoCamera.position.set(0, 0, 3)
    this.gizmoCamera.lookAt(0, 0, 0)
    this.gizmoGroup = this.buildGizmoGroup()
    this.gizmoScene.add(this.gizmoGroup)

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

  /** 构建 X/Y/Z 三轴 + 箭头 + 文字标签的 gizmo 组 */
  private buildGizmoGroup(): THREE.Group {
    const group = new THREE.Group()

    // AxesHelper：红/绿/蓝三轴线段
    const axes = new THREE.AxesHelper(0.85)
    // AxesHelper 的子节点是 LineSegments，强制 depthTest=false 让它始终可见
    axes.traverse((obj) => {
      const ls = obj as THREE.LineSegments
      if (ls.isLineSegments && ls.material instanceof THREE.LineBasicMaterial) {
        ls.material.depthTest = false
        ls.material.transparent = true
        ls.renderOrder = 999
      }
    })
    group.add(axes)

    // 三轴箭头（圆锥 + 短杆）：增强视觉
    const arrowSpecs: { axis: 'x' | 'y' | 'z'; color: number; dir: THREE.Vector3 }[] = [
      { axis: 'x', color: 0xff5566, dir: new THREE.Vector3(1, 0, 0) },
      { axis: 'y', color: 0x66ff88, dir: new THREE.Vector3(0, 1, 0) },
      { axis: 'z', color: 0x6699ff, dir: new THREE.Vector3(0, 0, 1) },
    ]
    for (const spec of arrowSpecs) {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.18),
        new THREE.MeshBasicMaterial({ color: spec.color, depthTest: false }),
      )
      shaft.position.copy(spec.dir).multiplyScalar(0.85)
      // Cylinder 默认沿 Y 轴，按 axis 方向旋转
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), spec.dir)
      shaft.quaternion.copy(quat)
      shaft.renderOrder = 999
      group.add(shaft)

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.22),
        new THREE.MeshBasicMaterial({ color: spec.color, depthTest: false }),
      )
      tip.position.copy(spec.dir).multiplyScalar(1.05)
      tip.quaternion.copy(quat)
      tip.renderOrder = 999
      group.add(tip)
    }

    // 三轴文字标签 Sprite：确保深度测试不影响
    const labelSpec: { text: string; color: string; pos: THREE.Vector3 }[] = [
      { text: 'X', color: '#ff5566', pos: new THREE.Vector3(1.3, 0, 0) },
      { text: 'Y', color: '#66ff88', pos: new THREE.Vector3(0, 1.3, 0) },
      { text: 'Z', color: '#6699ff', pos: new THREE.Vector3(0, 0, 1.3) },
    ]
    for (const ls of labelSpec) {
      const mat = new THREE.SpriteMaterial({
        map: makeAxisLabel(ls.text, ls.color),
        depthTest: false,
        depthWrite: false,
        transparent: true,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.position.copy(ls.pos)
      sprite.scale.set(0.45, 0.45, 0.45)
      sprite.renderOrder = 999
      group.add(sprite)
    }

    return group
  }

  /**
   * 把 gizmo 同步到主相机当前方向：每帧从主相机位置 → target 方向
   * 推出 gizmo 相机的视线，lookAt 始终 (0, 0, 0)，up 跟随主相机。
   */
  private syncGizmoCamera(): void {
    const dir = this.camera.position.clone().sub(this.controls.target)
    if (dir.lengthSq() < 1e-6) return
    dir.normalize()
    this.gizmoCamera.position.copy(dir).multiplyScalar(3)
    this.gizmoCamera.up.copy(this.camera.up)
    this.gizmoCamera.lookAt(0, 0, 0)
  }

  /**
   * 在主画布左上角 viewport 内绘制 gizmo；
   * 启用 scissor 让 gizmo 不影响主场景其它像素。
   */
  private renderGizmo(): void {
    const size = Math.min(
      this.renderer.domElement.width,
      this.renderer.domElement.height,
    )
    const gizmoSize = Math.round(size * 0.14)
    const margin = 12
    const x = margin
    const y = this.renderer.domElement.height - gizmoSize - margin

    this.syncGizmoCamera()
    this.renderer.setScissorTest(true)
    this.renderer.setScissor(x, y, gizmoSize, gizmoSize)
    this.renderer.setViewport(x, y, gizmoSize, gizmoSize)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear(true, true, true)
    this.renderer.render(this.gizmoScene, this.gizmoCamera)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height)
    this.renderer.setScissor(0, 0, this.renderer.domElement.width, this.renderer.domElement.height)
  }

  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.renderGizmo()
    }
    animate()
  }

  stop(): void {
    cancelAnimationFrame(this.animationId)
    this.resizeObserver?.disconnect()
    this.controls.dispose()
    // 释放 gizmo 资源
    this.gizmoScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry?.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
      }
      const sprite = obj as THREE.Sprite
      if (sprite.isSprite) sprite.material?.dispose()
    })
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
