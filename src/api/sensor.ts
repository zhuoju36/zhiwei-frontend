import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Position3D, Sensor } from '@/types'

/** device_id 必填，缺失返回 400 BAD_REQUEST */
export function listSensors(params: {
  device_id: number
  page?: number
  size?: number
}): Promise<PageData<Sensor>> {
  return request.get<unknown, PageData<Sensor>>('/sensors', { params })
}

/** 拉取设备下全部传感器 */
export function listAllSensors(deviceId: number): Promise<Sensor[]> {
  return fetchAllPages((page) => listSensors({ device_id: deviceId, page }))
}

export interface SensorCreatePayload {
  device_id: number
  sensor_code: string
  sensor_name?: string | null
  sensor_type?: string | null
  position?: Position3D | null
  model?: string | null
  manufacturer?: string | null
  install_date?: string | null
  last_calibration?: string | null
  metadata?: Record<string, unknown> | null
  note?: string | null
}

/** PUT 除 device_id/sensor_code 外可选（显式 null 表示清空） */
export function createSensor(payload: SensorCreatePayload): Promise<Sensor> {
  return request.post<unknown, Sensor>('/sensors', payload)
}

export function updateSensor(
  id: number,
  payload: Partial<{
    sensor_name: string | null
    sensor_type: string | null
    position: Position3D
    model: string | null
    manufacturer: string | null
    install_date: string | null
    last_calibration: string | null
    metadata: Record<string, unknown> | null
    note: string | null
    is_active: boolean
  }>,
): Promise<Sensor> {
  return request.put<unknown, Sensor>(`/sensors/${id}`, payload)
}

/** 删除传感器（仅 admin）→204 */
export function deleteSensor(id: number): Promise<void> {
  return request.delete<unknown, void>(`/sensors/${id}`)
}
