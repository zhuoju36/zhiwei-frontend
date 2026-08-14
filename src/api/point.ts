import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Point, PointPosition } from '@/types'

/** subitem_id 与 device_id 至少传一个，否则 400 BAD_REQUEST */
export function listPoints(params: {
  subitem_id?: number
  device_id?: number
  page?: number
  size?: number
}): Promise<PageData<Point>> {
  return request.get<unknown, PageData<Point>>('/points', { params })
}

/** 拉取子项/设备下全部测点 */
export function listAllPoints(filter: { subitem_id?: number; device_id?: number }): Promise<Point[]> {
  return fetchAllPages((page) => listPoints({ ...filter, page }))
}

export interface PointCreatePayload {
  device_id: number
  point_code: string
  point_name?: string | null
  point_type?: string | null
  position?: PointPosition | null
}

/** PUT 为 PATCH 语义：字段可选 */
export function createPoint(payload: PointCreatePayload): Promise<Point> {
  return request.post<unknown, Point>('/points', payload)
}

export function updatePoint(
  id: number,
  payload: Partial<{
    point_name: string | null
    point_type: string | null
    position: PointPosition
    is_active: boolean
  }>,
): Promise<Point> {
  return request.put<unknown, Point>(`/points/${id}`, payload)
}

/** 删除测点（仅 admin）→204 */
export function deletePoint(id: number): Promise<void> {
  return request.delete<unknown, void>(`/points/${id}`)
}
