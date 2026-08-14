/** 传感器（对应后端 SensorOut） */
export interface Sensor {
  id: number
  point_id: number
  sensor_code: string
  model: string | null
  manufacturer: string | null
  install_date: string | null
  last_calibration: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
