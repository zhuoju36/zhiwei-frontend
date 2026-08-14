import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Subitem } from '@/types'

export function getSubitems(page = 1, size = 200): Promise<PageData<Subitem>> {
  // 响应拦截器已解包信封，第二泛型声明实际返回类型
  return request.get<unknown, PageData<Subitem>>('/subitems', { params: { page, size } })
}

/** 拉取全部子项（普通用户仅返回被授权的子项） */
export function listAllSubitems(): Promise<Subitem[]> {
  return fetchAllPages((page) => getSubitems(page))
}

export function getSubitem(id: number): Promise<Subitem> {
  return request.get<unknown, Subitem>(`/subitems/${id}`)
}

export interface SubitemCreatePayload {
  name: string
  description?: string | null
  location?: { lat: number; lng: number; address?: string | null } | null
}

export function createSubitem(payload: SubitemCreatePayload): Promise<Subitem> {
  return request.post<unknown, Subitem>('/subitems', payload)
}

/** PUT 为 PATCH 语义：字段可选 */
export function updateSubitem(
  id: number,
  payload: Partial<SubitemCreatePayload>,
): Promise<Subitem> {
  return request.put<unknown, Subitem>(`/subitems/${id}`, payload)
}

/** 删除子项（仅 admin）→204 */
export function deleteSubitem(id: number): Promise<void> {
  return request.delete<unknown, void>(`/subitems/${id}`)
}

export type SubitemPermission = 'read' | 'write' | 'admin'

/** 授权用户访问子项（仅 admin）→204 */
export function assignUser(
  id: number,
  payload: { user_id: number; permission: SubitemPermission },
): Promise<void> {
  return request.post<unknown, void>(`/subitems/${id}/users`, payload)
}
