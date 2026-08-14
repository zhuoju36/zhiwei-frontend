/** 协议适配器信息（GET /protocols，公开） */
export interface ProtocolInfo {
  name: string
  version: string
  supports_batch: boolean
  config_schema: Record<string, unknown>
}
