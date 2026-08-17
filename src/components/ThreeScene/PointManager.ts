import * as THREE from 'three'
import type { PointStatus } from '@/types'

export interface PointVisual {
  pointId: number
  position: THREE.Vector3
  status: PointStatus
  value: number
  name: string
}

interface PointRecord {
  visual: PointVisual
  group: THREE.Group
  mesh: THREE.Mesh
  sprite: THREE.Sprite
  baseScale: number
}

/**
 * 测点管理器：每个 sensor 一个 Group（球 + 名称 Sprite）。
 * 设计权衡：
 * - 不再用 InstancedMesh（每个 Group 含独立 Mesh + Sprite），失去 1000+
 *   量级的性能优势，但换来名称 label + 鼠标交互的便利。当前项目里测点
 *   通常 < 100，普通 mesh 足够；后续若回到 1000+ 再切换 InstancedMesh +
 *   Sprite 集合
 * - 鼠标交互：hover 时放大 1.6x 并把材质 emissive 调亮；click 通过
 *   getPointByRay 命中 group.mesh 反查 pointId
 * - Sprite 名称：CanvasTexture 文字 + 半透明深色背板，深度测试关
 */
export class PointManager {
  private scene: THREE.Scene
  private records = new Map<number, PointRecord>()

  private colorNormal = new THREE.Color(0x67c23a)
  private colorWarning = new THREE.Color(0xe6a23c)
  private colorDanger = new THREE.Color(0xf56c6c)
  private colorHover = new THREE.Color(0xffffff)

  private raycastMeshes: THREE.Mesh[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /** 批量初始化测点（页面加载或项目切换时一次性调用） */
  initPoints(points: PointVisual[]): void {
    this.clear()

    for (const p of points) {
      const group = new THREE.Group()
      group.position.copy(p.position)

      // 球（普通 Mesh，便于逐个改 color / scale）
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 12),
        new THREE.MeshBasicMaterial({
          color: this.getColor(p.status),
          transparent: true,
          opacity: 0.95,
        }),
      )
      mesh.userData = { pointId: p.pointId }
      group.add(mesh)

      // 名称 Sprite：始终面向相机（自动 billboard）
      const sprite = makeNameSprite(p.name)
      sprite.position.set(0, 0.45, 0) // 测点上方
      sprite.userData = { pointId: p.pointId }
      group.add(sprite)

      this.scene.add(group)
      this.raycastMeshes.push(mesh)

      this.records.set(p.pointId, {
        visual: p,
        group,
        mesh,
        sprite,
        baseScale: 1,
      })
    }
  }

  /** 更新单个测点状态（WebSocket 实时数据触发） */
  updatePoint(pointId: number, value: number, status: PointStatus): void {
    const rec = this.records.get(pointId)
    if (!rec) return
    rec.visual.value = value
    rec.visual.status = status
    const mat = rec.mesh.material as THREE.MeshBasicMaterial
    mat.color.copy(this.getColor(status))
  }

  /**
   * 高亮（hover）指定测点：放大 + 切到白色 emissive 视觉提示；
   * 传 null 还原所有测点。
   */
  hoverPoint(pointId: number | null): void {
    for (const [id, rec] of this.records) {
      const isTarget = id === pointId
      rec.mesh.scale.setScalar(isTarget ? 1.6 : 1)
      const mat = rec.mesh.material as THREE.MeshBasicMaterial
      mat.color.copy(isTarget ? this.colorHover : this.getColor(rec.visual.status))
    }
  }

  /** 鼠标点击命中测点：raycaster 命中 mesh 反查 pointId */
  getPointByRay(raycaster: THREE.Raycaster): PointVisual | null {
    const hits = raycaster.intersectObjects(this.raycastMeshes, false)
    if (hits.length === 0) return null
    const pid = hits[0].object.userData.pointId as number
    return this.records.get(pid)?.visual ?? null
  }

  /** 当前 hover 的测点 id（用于设置 cursor: pointer） */
  getHoveredPointId(): number | null {
    for (const [id, rec] of this.records) {
      if (rec.mesh.scale.x > 1) return id
    }
    return null
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
    for (const rec of this.records.values()) {
      this.scene.remove(rec.group)
      rec.mesh.geometry.dispose()
      ;(rec.mesh.material as THREE.Material).dispose()
      rec.sprite.material.map?.dispose()
      ;(rec.sprite.material as THREE.Material).dispose()
    }
    this.records.clear()
    this.raycastMeshes = []
  }
}

/** 名称 Sprite 工厂：CanvasTexture + 深色半透明背板 + 白字 */
export function makeNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const W = 256
  const H = 64
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 半透明深色圆角背板
  ctx.fillStyle = 'rgba(20, 28, 48, 0.75)'
  roundRect(ctx, 4, 12, W - 8, H - 24, 8)
  ctx.fill()

  // 文字
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#e8eef7'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 截断过长名称（避免背板装不下）
  const display = name.length > 12 ? name.slice(0, 12) + '…' : name
  ctx.fillText(display, W / 2, H / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.colorSpace = THREE.SRGBColorSpace

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(0.8, 0.2, 1) // 与测点半径 0.15 相称：长 0.8、高 0.2
  return sprite
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}