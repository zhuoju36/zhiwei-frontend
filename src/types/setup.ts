/** 密码强度要求（GET /setup/status） */
export interface PasswordRequirements {
  min_length: number
  require_letter: boolean
  require_digit: boolean
  description: string
}

/** GET /setup/status 响应 data */
export interface SetupStatus {
  initialized: boolean
  password_requirements: PasswordRequirements
}

/** POST /setup/init-admin 响应 data */
export interface InitAdminResponse {
  admin_id: number
  username: string
  access_token: string
  refresh_token: string
  token_type: string
}
