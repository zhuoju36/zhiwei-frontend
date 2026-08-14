import request from './request'
import type { LatestValue, TimeInterval, TimeseriesResponse } from '@/types'

export interface TimeseriesParams {
  channel_id: number
  start: string
  end: string
  interval?: TimeInterval
}

export function getTimeseries(params: TimeseriesParams): Promise<TimeseriesResponse> {
  // 响应拦截器已解包信封，第二泛型声明实际返回类型
  return request.get<unknown, TimeseriesResponse>('/data/timeseries', { params })
}

/** 无数据时后端返回 data: null */
export function getLatest(channelId: number): Promise<LatestValue | null> {
  return request.get<unknown, LatestValue | null>(`/data/latest/${channelId}`)
}
