import type { PageData } from './types'

/** 分页拉全：total 超过单页时自动翻页拉完（多页并行） */
export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<PageData<T>>,
  pageSize = 200,
): Promise<T[]> {
  const first = await fetcher(1)
  if (first.total <= first.items.length) return first.items

  const pages = Math.ceil(first.total / pageSize)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => fetcher(i + 2)),
  )
  return [first, ...rest].flatMap((r) => r.items)
}
