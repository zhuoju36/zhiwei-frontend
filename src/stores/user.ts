import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import { parseJwt } from '@/utils/auth'
import type { JwtPayload } from '@/types'

const ACCESS_KEY = 'shm_access_token'
const REFRESH_KEY = 'shm_refresh_token'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(ACCESS_KEY) ?? '')
  const refreshToken = ref<string>(localStorage.getItem(REFRESH_KEY) ?? '')

  const payload = computed<JwtPayload | null>(() => (token.value ? parseJwt(token.value) : null))
  const role = computed<JwtPayload['role'] | ''>(() => payload.value?.role ?? '')
  const userId = computed<number | null>(() => {
    const sub = payload.value?.sub
    if (!sub) return null
    const n = Number(sub)
    return Number.isNaN(n) ? null : n
  })

  function setTokens(accessToken: string, newRefreshToken: string): void {
    token.value = accessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, newRefreshToken)
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await authApi.login(username, password)
    setTokens(res.access_token, res.refresh_token)
  }

  /** 刷新 access token，失败（含 401）返回 false */
  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const res = await authApi.refreshToken(refreshToken.value)
      setTokens(res.access_token, res.refresh_token)
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    token.value = ''
    refreshToken.value = ''
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  return { token, refreshToken, role, userId, login, refresh, logout, setTokens }
})
