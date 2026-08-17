/**
 * API 测试基础设施。
 * - 默认直连后端 8001，绕过 Vite 代理，避免代理差异混入
 * - 提供登录缓存 + 鉴权头
 * - 信封断言 + 响应原样 dump 工具（让"不一致"在失败信息中可见）
 */
import axios, { type AxiosResponse, type AxiosRequestConfig } from 'axios'
import { expect } from 'vitest'

export const API_BASE = process.env.API_BASE ?? 'http://localhost:8000'
export const API_V1 = `${API_BASE}/api/v1`

// 默认 T=any：测试里大量使用 `as` cast 收窄类型，此处放行为 any
// 让调用方在不显式指定类型时仍可访问 data 字段；具体类型在各测试中按需断言。
export interface Envelope<T = any> {
  code: string
  message: string
  data: T | null
  timestamp: string
}

/** 不抛异常的 axios 客户端；4xx/5xx 也返回 {status,data}。 */
export const http = axios.create({
  baseURL: API_V1,
  timeout: 15_000,
  validateStatus: () => true,
})

/** 接口校验用的"任意信封"匹配器 */
export const envelopeShape = () => ({
  code: expect.any(String),
  message: expect.any(String),
  data: expect.anything(),
  timestamp: expect.any(String),
})

/** 登录得到 access/refresh token，进程级缓存避免重复登录（按 username 分键） */
interface TokenPair { access: string; refresh: string }
const tokenCache = new Map<string, TokenPair>()

export async function login(username = 'admin', password = 'Admin1234'): Promise<TokenPair> {
  const cached = tokenCache.get(username)
  if (cached) return cached
  const body = new URLSearchParams({ username, password })
  const res = await http.post<Envelope<{
    access_token: string
    refresh_token: string
    token_type: string
  }>>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  expect(res.status, `login HTTP ${res.status}`).toBe(200)
  expect(res.data.code, `login code: ${res.data?.code}`).toBe('OK')
  const pair: TokenPair = { access: res.data.data!.access_token, refresh: res.data.data!.refresh_token }
  tokenCache.set(username, pair)
  return pair
}

export function authHeaders(t: TokenPair): AxiosRequestConfig['headers'] {
  return { Authorization: `Bearer ${t.access}` }
}

/** 已鉴权请求便捷封装 */
export async function authed<T = any>(
  config: AxiosRequestConfig & { auth?: TokenPair },
): Promise<AxiosResponse<Envelope<T>>> {
  const t = config.auth ?? (await login())
  return http.request<Envelope<T>>({
    ...config,
    headers: { ...(config.headers ?? {}), ...authHeaders(t) },
  })
}

/** 失败用例的便利封装：不带 token */
export async function anon<T = any>(config: AxiosRequestConfig) {
  return http.request<Envelope<T>>(config)
}

/** 打 printable dump：把响应打印到测试失败信息里 */
export function dump(label: string, value: unknown) {
  // vitest 默认失败时只显示值，所以这里强制序列化
  // eslint-disable-next-line no-console
  console.error(`\n[${label}]\n${JSON.stringify(value, null, 2)}\n`)
}

/** 让失败信息更直观 */
export function assertEnvelope(label: string, body: any): asserts body is Envelope {
  if (!body || typeof body !== 'object') {
    dump(label, body)
    throw new Error(`${label}: 响应不是对象`)
  }
  for (const k of ['code', 'message', 'timestamp']) {
    if (typeof body[k] !== 'string') {
      dump(label, body)
      throw new Error(`${label}: 缺少字符串字段 ${k} (实际 ${typeof body[k]})`)
    }
  }
  if (!('data' in body)) {
    dump(label, body)
    throw new Error(`${label}: 缺少 data 字段`)
  }
}

/** 解析 token 过期时间（无签名校验，仅用于刷新判断） */
export function jwtExp(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  return payload.exp * 1000
}

/** 唯一化测试资源名前缀，避免多次跑冲突 */
export const tag = `t${Date.now().toString(36)}`
export const uniq = (k: string) => `${tag}-${k}`

/**
 * 解包分页响应。list 端点返回 { total, page, size, items }
 * （projects/users/devices/sensors/channels/alerts/analysis/jobs）
 * 用法：const items = pageItems(res.data.data)
 */
export function pageItems<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const items = (data as any).items
    if (Array.isArray(items)) return items as T[]
  }
  throw new Error(`expected paginated or array data, got ${JSON.stringify(data)?.slice(0, 200)}`)
}

export function pageMeta(data: unknown): { total: number; page: number; size: number } {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as any
    return { total: Number(d.total ?? 0), page: Number(d.page ?? 1), size: Number(d.size ?? 0) }
  }
  throw new Error('not paginated shape')
}
