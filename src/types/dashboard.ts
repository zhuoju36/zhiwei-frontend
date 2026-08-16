/** 设备状态聚合（GET /dashboard/overview 元素） */
export interface DeviceStats {
  total: number
  online: number
  offline: number
  error: number
}

/** 项目概览项（含设备状态聚合） */
export interface ProjectOverviewItem {
  id: number
  name: string
  description: string | null
  location: { lat: number; lng: number; address: string | null } | null
  device_stats: DeviceStats
}

/** GET /dashboard/overview 响应 data */
export interface DashboardOverview {
  projects: ProjectOverviewItem[]
}