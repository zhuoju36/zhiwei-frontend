/** 后端统一响应信封 */
export interface Envelope<T> {
  code: string
  message: string
  data: T
  timestamp: string
}

/** 分页数据结构 */
export interface PageData<T> {
  total: number
  page: number
  size: number
  items: T[]
}
