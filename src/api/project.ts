import request from './request'
import { fetchAllPages } from './pager'
import type { PageData } from './types'
import type { Project } from '@/types'

export function getProjects(page = 1, size = 200): Promise<PageData<Project>> {
  // 响应拦截器已解包信封，第二泛型声明实际返回类型
  return request.get<unknown, PageData<Project>>('/projects', { params: { page, size } })
}

/** 拉取全部项目（普通用户仅返回被授权的项目） */
export function listAllProjects(): Promise<Project[]> {
  return fetchAllPages((page) => getProjects(page))
}

export function getProject(id: number): Promise<Project> {
  return request.get<unknown, Project>(`/projects/${id}`)
}

export interface ProjectCreatePayload {
  name: string
  description?: string | null
  location?: { lat: number; lng: number; address?: string | null } | null
}

export function createProject(payload: ProjectCreatePayload): Promise<Project> {
  return request.post<unknown, Project>('/projects', payload)
}

/** PUT 为 PATCH 语义：字段可选 */
export function updateProject(
  id: number,
  payload: Partial<ProjectCreatePayload>,
): Promise<Project> {
  return request.put<unknown, Project>(`/projects/${id}`, payload)
}

/** 删除项目（仅 admin）→204 */
export function deleteProject(id: number): Promise<void> {
  return request.delete<unknown, void>(`/projects/${id}`)
}

export type ProjectPermission = 'read' | 'write' | 'admin'

/** 授权用户访问项目（仅 admin）→204 */
export function assignUser(
  id: number,
  payload: { user_id: number; permission: ProjectPermission },
): Promise<void> {
  return request.post<unknown, void>(`/projects/${id}/users`, payload)
}
