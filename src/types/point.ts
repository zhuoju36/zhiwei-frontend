/** 测点三维坐标（未绑定时为 null） */
export interface PointPosition {
  x: number
  y: number
  z: number
}

/** 测点（对应后端 PointOut） */
export interface Point {
  id: number
  device_id: number
  point_code: string
  point_name: string
  point_type: string
  unit: string | null
  position: PointPosition | null
  alert_rules: unknown[] | null
  sampling_rate: number | null
  is_active: boolean
  created_at: string
}
