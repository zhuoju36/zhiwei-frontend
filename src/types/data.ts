/** 数据质量（后端枚举） */
export type Quality = 'good' | 'bad' | 'uncertain'

/** 测点状态（由 quality 映射而来，用于颜色展示） */
export type PointStatus = 'normal' | 'warning' | 'danger'

/** 时序聚合间隔 */
export type TimeInterval = 'raw' | '100ms' | '1s' | '1m' | '1h' | '1d'

/**
 * 时序数据点。raw 档（raw/100ms/1s 且跨度≤1h）只填 ts/value；
 * 聚合档只填 ts/avg_val/max_val/min_val/rms_val。
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
  point_id: number
  interval: string
  data: TimeSeriesItem[]
}

/** GET /data/latest/{point_id} 响应 data（无数据时为 null） */
export interface LatestValue {
  point_id: number
  value: number
  unit: string
  quality: Quality
  timestamp: string
}

/** WS data:realtime 的 payload */
export interface RealtimePayload {
  point_id: number
  value: number
  unit: string
  quality: Quality
  timestamp: string
}

/** WS 下行消息 */
export type WsMessage =
  | { type: 'data:realtime'; payload: RealtimePayload }
  | { type: 'cmd:subscribed'; project_id: number }
  | { type: string; [key: string]: unknown }
