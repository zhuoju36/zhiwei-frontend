/** 测点三维坐标（未绑定时为 null） */
export interface PointPosition {
  x: number
  y: number
  z: number
}

/** 测点（对应后端 PointOut；仅物理位置，无 unit/告警规则） */
export interface Point {
  id: number
  device_id: number
  point_code: string
  point_name: string | null
  point_type: string | null
  position: PointPosition | null
  is_active: boolean
  created_at: string
}
