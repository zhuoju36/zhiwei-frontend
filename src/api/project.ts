import request from './request'
import type { PageData } from './types'
import type { Project } from '@/types'

export function getProjects(page = 1, size = 50): Promise<PageData<Project>> {
  // 响应拦截器已解包信封，第二泛型声明实际返回类型
  return request.get<unknown, PageData<Project>>('/projects', { params: { page, size } })
}

export function getProject(id: number): Promise<Project> {
  return request.get<unknown, Project>(`/projects/${id}`)
}
