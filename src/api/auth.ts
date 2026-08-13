import axios from 'axios'
import type { Envelope } from './types'
import type { LoginResponse } from '@/types'

const baseURL: string = import.meta.env.VITE_API_BASE_URL

// 认证接口不走 request 实例，避免 401 刷新逻辑自我循环
export function login(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username, password })
  return axios
    .post<Envelope<LoginResponse>>(`${baseURL}/auth/login`, body)
    .then((res) => res.data.data)
}

export function refreshToken(refreshTokenValue: string): Promise<LoginResponse> {
  return axios
    .post<Envelope<LoginResponse>>(`${baseURL}/auth/refresh`, { refresh_token: refreshTokenValue })
    .then((res) => res.data.data)
}
