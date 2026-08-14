/** 平台信息（对应后端 PlatformOut） */
export interface PlatformInfo {
  platform_name: string
  contact_email: string | null
  description: string | null
  logo_url: string | null
  updated_at: string
  updated_by: number | null
}
