/** JWT payload（后端签发） */
export interface JwtPayload {
  /** user_id */
  sub: string
  role: 'admin' | 'user'
  type: 'access' | 'refresh'
  exp: number
}

/** 登录/刷新响应 */
export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

/** 用户角色 */
export type UserRole = 'admin' | 'user'

/** 用户（对应后端 UserOut，仅 admin 可查） */
export interface UserOut {
  id: number
  username: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}
