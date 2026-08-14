/** 告警级别 */
export type AlertLevel = 'info' | 'warning' | 'danger'

/** 告警（对应后端 AlertOut） */
export interface Alert {
  id: number
  channel_id: number
  alert_type: string
  level: AlertLevel
  message: string | null
  value: number | null
  threshold: number | null
  started_at: string
  ended_at: string | null
  is_resolved: boolean
  resolved_by: number | null
}
