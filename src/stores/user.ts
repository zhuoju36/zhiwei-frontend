import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import type { UserProfile } from '@/types'

const ACCESS_KEY = 'shm_access_token'
const REFRESH_KEY = 'shm_refresh_token'
const PROFILE_KEY = 'shm_user_profile'

/** 从 localStorage 恢复 profile（best-effort；JSON 损坏则视为未登录） */
function readProfile(): UserProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (
      typeof p?.userId === 'number' &&
      typeof p?.username === 'string' &&
      (p?.role === 'admin' || p?.role === 'user')
    ) {
      return p as UserProfile
    }
  } catch {
    /* fallthrough */
  }
  return null
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(ACCESS_KEY) ?? '')
  const refreshToken = ref<string>(localStorage.getItem(REFRESH_KEY) ?? '')
  const profile = ref<UserProfile | null>(readProfile())

  /** 当前档案角色（未登录返回空字符串）；路由守卫依赖此字段 */
  const role = ref<UserProfile['role'] | ''>(profile.value?.role ?? '')
  const userId = ref<UserProfile['userId'] | null>(profile.value?.userId ?? null)
  const username = ref<UserProfile['username'] | ''>(profile.value?.username ?? '')

  function persistProfile(): void {
    if (profile.value) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
    else localStorage.removeItem(PROFILE_KEY)
  }

  function setTokens(accessToken: string, newRefreshToken: string): void {
    token.value = accessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, newRefreshToken)
  }

  /** 直接用服务器返回的 profile 字段写入 store + 持久化（不走 JWT 解析） */
  function setProfile(p: UserProfile): void {
    profile.value = p
    role.value = p.role
    userId.value = p.userId
    username.value = p.username
    persistProfile()
  }

  async function login(usernameInput: string, password: string): Promise<void> {
    const res = await authApi.login(usernameInput, password)
    setTokens(res.access_token, res.refresh_token)
    setProfile({
      userId: res.user_id,
      username: res.username,
      email: res.email,
      role: res.role,
      isActive: res.is_active,
    })
  }

  /** 刷新 access token，失败（含 401）返回 false */
  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const res = await authApi.refreshToken(refreshToken.value)
      setTokens(res.access_token, res.refresh_token)
      setProfile({
        userId: res.user_id,
        username: res.username,
        email: res.email,
        role: res.role,
        isActive: res.is_active,
      })
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    token.value = ''
    refreshToken.value = ''
    profile.value = null
    role.value = ''
    userId.value = null
    username.value = ''
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(PROFILE_KEY)
  }

  return {
    token,
    refreshToken,
    profile,
    role,
    userId,
    username,
    setTokens,
    setProfile,
    login,
    refresh,
    logout,
  }
})
