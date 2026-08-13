import request from './request'
import type { PageData } from './types'
import type { Point } from '@/types'

const PAGE_SIZE = 200

function fetchPage(projectId: number, page: number): Promise<PageData<Point>> {
  // 响应拦截器已解包信封，第二泛型声明实际返回类型
  return request.get<unknown, PageData<Point>>('/points', {
    params: { project_id: projectId, page, size: PAGE_SIZE },
  })
}

/** 拉取项目全部测点（total 超过单页 size 时自动翻页拉完） */
export async function listPoints(projectId: number): Promise<Point[]> {
  const first = await fetchPage(projectId, 1)
  if (first.total <= first.items.length) return first.items

  const pages = Math.ceil(first.total / PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => fetchPage(projectId, i + 2)),
  )
  return [first, ...rest].flatMap((r) => r.items)
}
