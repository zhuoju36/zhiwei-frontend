/** 告警规则（channel.alert_rules 内元素） */
export interface AlertRule {
  operator: 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne'
  threshold: number
  level: 'info' | 'warning' | 'danger'
  message?: string
  suppress_seconds: number
}

/** 通道（对应后端 ChannelOut） */
export interface Channel {
  id: number
  sensor_id: number
  channel_code: string
  channel_type: string | null
  unit: string | null
  sampling_rate: number
  position_offset: Record<string, unknown> | null
  axis: string | null
  alert_rules: AlertRule[] | null
  is_active: boolean
  created_at: string
}
