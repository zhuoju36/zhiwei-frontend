import type { JwtPayload } from '@/types'

/**
 * 解析 JWT payload，失败返回 null。
 * 只做 base64url 解码，不校验签名（签名校验是后端的职责）。
 */
export function parseJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.from(atob(base64))
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/** 判断 token 是否已过期（含提前量，默认提前 30 秒视为过期） */
export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = parseJwt(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
}
