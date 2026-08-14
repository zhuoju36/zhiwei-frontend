import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { AlertRule, Channel } from '@/types'

export function listChannels(params: {
  sensor_id: number
  page?: number
  size?: number
}): Promise<PageData<Channel>> {
  return request.get<unknown, PageData<Channel>>('/channels', { params })
}

/** 拉取传感器下全部通道 */
export function listAllChannels(sensorId: number): Promise<Channel[]> {
  return fetchAllPages((page) => listChannels({ sensor_id: sensorId, page }))
}

export interface ChannelCreatePayload {
  sensor_id: number
  channel_code: string
  channel_type?: string | null
  unit?: string | null
  sampling_rate?: number
  position_offset?: Record<string, unknown> | null
  axis?: string | null
  note?: string | null
  alert_rules?: AlertRule[] | null
}

/** PUT 为 PATCH 语义：字段可选（显式 null 表示清空） */
export function createChannel(payload: ChannelCreatePayload): Promise<Channel> {
  return request.post<unknown, Channel>('/channels', payload)
}

export function updateChannel(
  id: number,
  payload: Partial<{
    channel_type: string | null
    unit: string | null
    sampling_rate: number
    position_offset: Record<string, unknown> | null
    axis: string | null
    note: string | null
    alert_rules: AlertRule[]
    is_active: boolean
  }>,
): Promise<Channel> {
  return request.put<unknown, Channel>(`/channels/${id}`, payload)
}

/** 删除通道（仅 admin）→204 */
export function deleteChannel(id: number): Promise<void> {
  return request.delete<unknown, void>(`/channels/${id}`)
}
