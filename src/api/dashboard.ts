import request from './request'
import type { Alert } from '@/types'

/** GET /dashboard/stats 响应 data */
export interface DashboardStats {
  active_alerts: number
  alerts_24h: number
  by_level: Record<string, number>
  recent_alerts: Alert[]
  subitem_id: number | null
}

export function getStats(subitemId?: number): Promise<DashboardStats> {
  return request.get<unknown, DashboardStats>('/dashboard/stats', {
    params: subitemId != null ? { subitem_id: subitemId } : {},
  })
}

export function getRecentAlerts(subitemId?: number, limit = 10): Promise<Alert[]> {
  return request.get<unknown, Alert[]>('/dashboard/recent-alerts', {
    params: {
      ...(subitemId != null ? { subitem_id: subitemId } : {}),
      limit,
    },
  })
}
