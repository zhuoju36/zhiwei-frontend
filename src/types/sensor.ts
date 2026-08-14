/** 三维坐标（position；3D 大屏测点标记位置，未绑定时为 null） */
export interface Position3D {
  x: number
  y: number
  z: number
}

/** 传感器（对应后端 SensorOut；v0.9 起测点与传感器合一，位置并入 sensor） */
export interface Sensor {
  id: number
  device_id: number
  sensor_code: string
  sensor_name: string | null
  sensor_type: string | null
  model: string | null
  manufacturer: string | null
  install_date: string | null
  last_calibration: string | null
  position: Position3D | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  note: string | null
  created_at: string
}
