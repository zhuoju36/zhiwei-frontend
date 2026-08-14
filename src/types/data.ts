import type { AlertLevel } from './alert'

/** 数据质量（后端枚举） */
export type Quality = 'good' | 'bad' | 'uncertain'

/** 测点/通道状态（由 quality 映射而来，用于颜色展示） */
export type PointStatus = 'normal' | 'warning' | 'danger'

/** 时序聚合间隔 */
export type TimeInterval = 'raw' | '100ms' | '1s' | '1m' | '1h' | '1d'

/**
 * 时序数据点。raw 档（raw/100ms/1s 且跨度≤1h）只填 ts/value；
 * 聚合档只填 ts/avg_val/max_val/min_val/rms_val。
 * 后端当前恒查原始表：value 恒有值，聚合字段恒 null。
 */
export interface TimeSeriesItem {
  ts: string
  value: number | null
  avg_val: number | null
  max_val: number | null
  min_val: number | null
  rms_val: number | null
}

/** GET /data/timeseries 响应 data */
export interface TimeseriesResponse {
  channel_id: number
  interval: string
  data: TimeSeriesItem[]
}

/** GET /data/latest/{channel_id} 响应 data（无数据时为 null） */
export interface LatestValue {
  channel_id: number
  device_code: string
  channel_code: string
  value: number
  unit: string
  quality: Quality
  timestamp: string
}

/** WS data:realtime 的 payload */
export interface RealtimePayload {
  channel_id: number
  device_code: string
  channel_code: string
  value: number
  unit: string
  quality: Quality
  timestamp: string
}

/** WS data:alert 的 payload（resolved 帧只含 alert_id/channel_id/level/status/ended_at） */
export interface WsAlertPayload {
  alert_id: number
  channel_id: number
  level: AlertLevel
  value: number | null
  threshold: number | null
  message: string | null
  status: 'triggered' | 'updated' | 'resolved'
  started_at: string
  ended_at: string | null
}

/** WS 下行消息 */
export type WsMessage =
  | { type: 'data:realtime'; payload: RealtimePayload }
  | { type: 'data:alert'; payload: WsAlertPayload }
  | { type: 'cmd:subscribed'; subitem_id: number }
  | { type: 'cmd:error'; code: string; message: string; subitem_id: number }
  | { type: string; [key: string]: unknown }
