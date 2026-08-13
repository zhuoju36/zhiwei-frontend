import * as THREE from 'three'
import type { PointStatus } from '@/types'

export interface PointVisual {
  pointId: number
  position: THREE.Vector3
  status: PointStatus
  value: number
  name: string
}

/**
 * 测点管理器：InstancedMesh 批量渲染（1000+ 测点性能关键），
 * 外加不可见代理 Mesh 做射线检测。
 * 本阶段无测点坐标数据源（后端 /points 未上线），代码就位待接入。
 */
export class PointManager {
  private scene: THREE.Scene
  private pointMap = new Map<number, PointVisual>()
  private indexMap = new Map<number, number>()
  private instanceMesh: THREE.InstancedMesh | null = null
  private dummy = new THREE.Object3D()
  private colorNormal = new THREE.Color(0x67c23a)
  private colorWarning = new THREE.Color(0xe6a23c)
  private colorDanger = new THREE.Color(0xf56c6c)
  private raycastTargets: THREE.Mesh[] = [] // 用于射线检测的代理 Mesh

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /** 批量初始化测点（页面加载时一次性调用） */
  initPoints(points: PointVisual[]): void {
    // 清理旧数据
    this.clear()

    const geometry = new THREE.SphereGeometry(0.15, 8, 8) // 低面数球体
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff })

    this.instanceMesh = new THREE.InstancedMesh(geometry, material, points.length)
    this.instanceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.instanceMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(points.length * 3),
      3,
    )

    points.forEach((p, i) => {
      this.pointMap.set(p.pointId, p)
      this.indexMap.set(p.pointId, i)

      // 设置位置
      this.dummy.position.copy(p.position)
      this.dummy.updateMatrix()
      this.instanceMesh!.setMatrixAt(i, this.dummy.matrix)

      // 设置颜色
      this.instanceMesh!.setColorAt(i, this.getColor(p.status))

      // 创建不可见的射线检测代理（InstancedMesh 本身射线检测性能差）
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 4, 4), // 稍大，方便点击
        new THREE.MeshBasicMaterial({ visible: false }),
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
  updatePoint(pointId: number, value: number, status: PointStatus): void {
    const point = this.pointMap.get(pointId)
    if (!point || !this.instanceMesh) return

    point.value = value
    point.status = status

    const index = this.indexMap.get(pointId)
    if (index == null) return
    this.instanceMesh.setColorAt(index, this.getColor(status))
    this.instanceMesh.instanceColor!.needsUpdate = true
  }

  /** 高亮测点（用户点击/悬停），后续以高亮环实现 */
  highlightPoint(_pointId: number | null): void {
    // 可通过额外的一个 InstancedMesh 或 Sprite 实现高亮环
    // 避免修改原 instanceMesh 的矩阵
  }

  getPointByRay(raycaster: THREE.Raycaster): PointVisual | null {
    const intersects = raycaster.intersectObjects(this.raycastTargets)
    if (intersects.length === 0) return null
    const pid = intersects[0].object.userData.pointId as number
    return this.pointMap.get(pid) || null
  }

  private getColor(status: PointStatus): THREE.Color {
    switch (status) {
      case 'warning':
        return this.colorWarning
      case 'danger':
        return this.colorDanger
      default:
        return this.colorNormal
    }
  }

  clear(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh)
      this.instanceMesh.dispose()
      this.instanceMesh = null
    }
    this.raycastTargets.forEach((m) => this.scene.remove(m))
    this.raycastTargets = []
    this.pointMap.clear()
    this.indexMap.clear()
  }
}
