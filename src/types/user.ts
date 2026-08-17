/**
 * 登录 / 刷新响应（后端 LoginResponse，含用户档案字段；不需要解 JWT）。
 * 与旧版的差异：补 user_id / username / email / role / is_active，前端不再依赖 parseJwt。
 */
export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user_id: number
  username: string
  email: string | null
  role: UserRole
  is_active: boolean
}

/** 用户角色 */
export type UserRole = 'admin' | 'user'

/** 用户档案（持久化于 stores/user，用于路由守卫 / Header 显示） */
export interface UserProfile {
  userId: number
  username: string
  email: string | null
  role: UserRole
  isActive: boolean
}

/** 用户（对应后端 UserOut，仅 admin 可查） */
export interface UserOut {
  id: number
  username: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}
