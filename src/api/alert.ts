import request from './request'
import type { PageData } from './types'
import type { Alert, AlertLevel } from '@/types'

export interface AlertListParams {
  /** 前端始终传 project_id；不传时后端不过滤（admin 可见全量） */
  project_id?: number
  channel_id?: number
  level?: AlertLevel
  is_resolved?: boolean
  /** started_at 时间窗口 */
  start?: string
  end?: string
  page?: number
  size?: number
}

/** 告警列表（started_at 倒序） */
export function listAlerts(params: AlertListParams): Promise<PageData<Alert>> {
  return request.get<unknown, PageData<Alert>>('/alerts', { params })
}

export function getAlert(id: number): Promise<Alert> {
  return request.get<unknown, Alert>(`/alerts/${id}`)
}

/** 确认告警（需要项目 admin 权限；无权限后端 403 FORBIDDEN） */
export function acknowledgeAlert(id: number): Promise<Alert> {
  return request.post<unknown, Alert>(`/alerts/${id}/acknowledge`)
}
