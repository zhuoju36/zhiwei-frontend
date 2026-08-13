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
