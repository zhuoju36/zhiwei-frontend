import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Sensor } from '@/types'

export function listSensors(params: {
  point_id: number
  page?: number
  size?: number
}): Promise<PageData<Sensor>> {
  return request.get<unknown, PageData<Sensor>>('/sensors', { params })
}

/** 拉取测点下全部传感器 */
export function listAllSensors(pointId: number): Promise<Sensor[]> {
  return fetchAllPages((page) => listSensors({ point_id: pointId, page }))
}

export interface SensorCreatePayload {
  point_id: number
  sensor_code: string
  model?: string | null
  manufacturer?: string | null
  install_date?: string | null
  last_calibration?: string | null
  metadata?: Record<string, unknown> | null
}

/** PUT 除 point_id/sensor_code 外可选（显式 null 表示清空） */
export function createSensor(payload: SensorCreatePayload): Promise<Sensor> {
  return request.post<unknown, Sensor>('/sensors', payload)
}

export function updateSensor(
  id: number,
  payload: Partial<{
    model: string | null
    manufacturer: string | null
    install_date: string | null
    last_calibration: string | null
    metadata: Record<string, unknown> | null
  }>,
): Promise<Sensor> {
  return request.put<unknown, Sensor>(`/sensors/${id}`, payload)
}

/** 删除传感器（仅 admin）→204 */
export function deleteSensor(id: number): Promise<void> {
  return request.delete<unknown, void>(`/sensors/${id}`)
}
