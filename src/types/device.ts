/** 设备在线状态（后端枚举） */
export type DeviceStatus = 'online' | 'offline' | 'error'

/** 设备（对应后端 DeviceOut） */
export interface Device {
  id: number
  subitem_id: number
  device_code: string
  device_name: string | null
  protocol: string
  config: Record<string, unknown>
  status: DeviceStatus
  last_seen: string | null
  created_at: string
}
