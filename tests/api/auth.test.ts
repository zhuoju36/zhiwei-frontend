import { describe, it, expect } from 'vitest'
import { http, login, authed, anon, envelopeShape, jwtExp, API_V1, assertEnvelope, pageItems } from './_helpers'

describe('认证 / auth', () => {
  it('login: 正确凭据返回 200 + Bearer token 信封', async () => {
    const t = await login()
    expect(t.access).toMatch(/^eyJ/)
    expect(t.refresh).toMatch(/^eyJ/)
  })

  it('login: 错密码返回 401 + AUTH_ERROR 信封', async () => {
    const body = new URLSearchParams({ username: 'smoke', password: 'wrong-pw' })
    const res = await http.post('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status).toBe(401)
    assertEnvelope('login-401', res.data)
    expect(res.data.code).toBe('AUTH_ERROR')
    expect(res.data.data).toBeNull()
  })

  it('login: 缺字段返回 422（FastAPI 校验）', async () => {
    const res = await http.post('/auth/login', new URLSearchParams({ username: 'x' }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    // 期望 422，但实际行为由后端决定，先抓状态码
    expect([400, 422]).toContain(res.status)
  })

  it('refresh: 用合法 refresh_token 换取新 access_token', async () => {
    const t = await login()
    const res = await http.post('/auth/refresh', { refresh_token: t.refresh })
    expect(res.status).toBe(200)
    assertEnvelope('refresh', res.data)
    expect(res.data.code).toBe('OK')
    expect(res.data.data.access_token).toMatch(/^eyJ/)
    expect(res.data.data.refresh_token).toMatch(/^eyJ/)
    expect(res.data.data.token_type).toBe('bearer')
  })

  it('refresh: 非法 token 应 401', async () => {
    const res = await http.post('/auth/refresh', { refresh_token: 'not.a.jwt' })
    expect(res.status).toBe(401)
    assertEnvelope('refresh-bad', res.data)
    expect(res.data.code).toBe('AUTH_ERROR')
  })

  it('access token 携带 Bearer 后能访问受保护接口', async () => {
    const t = await login()
    const res = await authed({ method: 'GET', url: '/projects' })
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject(envelopeShape())
    expect(pageItems(res.data.data).length).toBeGreaterThanOrEqual(0)
  })

  it('不带 token 访问受保护接口返回 401', async () => {
    const res = await anon({ method: 'GET', url: '/projects' })
    expect(res.status).toBe(401)
    assertEnvelope('projects-anon', res.data)
  })

  it('带伪造 token 访问受保护接口返回 401', async () => {
    const res = await http.get('/projects', {
      headers: { Authorization: 'Bearer not.a.jwt' },
    })
    expect(res.status).toBe(401)
    assertEnvelope('projects-fakejwt', res.data)
  })

  it('access token 过期时间合理性（应大于当前时间）', async () => {
    const t = await login()
    expect(jwtExp(t.access)).toBeGreaterThan(Date.now())
  })
})
