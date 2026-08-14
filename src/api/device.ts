import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Device, DeviceStatus } from '@/types'

export function listDevices(params: {
  subitem_id: number
  page?: number
  size?: number
}): Promise<PageData<Device>> {
  return request.get<unknown, PageData<Device>>('/devices', { params })
}

/** 拉取子项下全部设备 */
export function listAllDevices(subitemId: number): Promise<Device[]> {
  return fetchAllPages((page) => listDevices({ subitem_id: subitemId, page }))
}

export interface DeviceCreatePayload {
  subitem_id: number
  device_code: string
  device_name?: string | null
  protocol: string
  config?: Record<string, unknown>
}

/** PUT 为 PATCH 语义：字段可选 */
export function createDevice(payload: DeviceCreatePayload): Promise<Device> {
  return request.post<unknown, Device>('/devices', payload)
}

export function updateDevice(
  id: number,
  payload: Partial<{
    device_name: string | null
    protocol: string
    config: Record<string, unknown>
    status: DeviceStatus
    last_seen: string
  }>,
): Promise<Device> {
  return request.put<unknown, Device>(`/devices/${id}`, payload)
}

/** 删除设备（仅 admin）→204 */
export function deleteDevice(id: number): Promise<void> {
  return request.delete<unknown, void>(`/devices/${id}`)
}
