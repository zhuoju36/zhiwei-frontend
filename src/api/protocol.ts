import request from './request'
import type { ProtocolInfo } from '@/types'

/** 协议适配器列表（公开接口，无需登录） */
export function listProtocols(): Promise<ProtocolInfo[]> {
  return request.get<unknown, ProtocolInfo[]>('/protocols')
}
