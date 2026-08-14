import request from './request'
import type { PlatformInfo } from '@/types'

/** 平台信息（公开接口） */
export function getPlatform(): Promise<PlatformInfo> {
  return request.get<unknown, PlatformInfo>('/platform')
}

/** 更新平台信息（仅 admin；字段至少一个，否则 422 EMPTY_UPDATE） */
export function updatePlatform(
  payload: Partial<{
    platform_name: string
    contact_email: string
    description: string
    logo_url: string
  }>,
): Promise<PlatformInfo> {
  return request.put<unknown, PlatformInfo>('/platform', payload)
}
