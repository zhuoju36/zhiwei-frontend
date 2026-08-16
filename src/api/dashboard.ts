import request from './request'
import type { Alert } from '@/types'
import type { DashboardOverview } from '@/types/dashboard'

/** GET /dashboard/stats 响应 data */
export interface DashboardStats {
  active_alerts: number
  alerts_24h: number
  by_level: Record<string, number>
  recent_alerts: Alert[]
  project_id: number | null
}

export function getStats(projectId?: number): Promise<DashboardStats> {
  return request.get<unknown, DashboardStats>('/dashboard/stats', {
    params: projectId != null ? { project_id: projectId } : {},
  })
}

export function getRecentAlerts(projectId?: number, limit = 10): Promise<Alert[]> {
  return request.get<unknown, Alert[]>('/dashboard/recent-alerts', {
    params: {
      ...(projectId != null ? { project_id: projectId } : {}),
      limit,
    },
  })
}

/** GET /dashboard/overview：所有项目 + 设备状态聚合（一次拉完，避免前端循环查） */
export function getOverview(): Promise<DashboardOverview> {
  return request.get<unknown, DashboardOverview>('/dashboard/overview')
}
