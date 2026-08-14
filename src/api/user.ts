import request from './request'
import type { PageData } from './types'
import type { UserOut, UserRole } from '@/types'

/** 用户列表（仅 admin） */
export function listUsers(params: {
  username?: string
  role?: UserRole
  is_active?: boolean
  page?: number
  size?: number
}): Promise<PageData<UserOut>> {
  return request.get<unknown, PageData<UserOut>>('/users', { params })
}

export interface UserCreatePayload {
  username: string
  email: string
  password: string
  role?: UserRole
}

export function createUser(payload: UserCreatePayload): Promise<UserOut> {
  return request.post<unknown, UserOut>('/users', payload)
}

/** 更新用户（不含密码，密码走 resetPassword） */
export function updateUser(
  id: number,
  payload: { email?: string; role?: UserRole; is_active?: boolean },
): Promise<UserOut> {
  return request.put<unknown, UserOut>(`/users/${id}`, payload)
}

/** 删除用户（仅 admin；LAST_ADMIN/SELF_PROTECTED 由后端 409 拒绝）→204 */
export function deleteUser(id: number): Promise<void> {
  return request.delete<unknown, void>(`/users/${id}`)
}

/** 重置用户密码（仅 admin）→204 */
export function resetPassword(id: number, newPassword: string): Promise<void> {
  return request.post<unknown, void>(`/users/${id}/password`, { new_password: newPassword })
}
