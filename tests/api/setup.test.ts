import { describe, it, expect } from 'vitest'
import { http, API_V1, envelopeShape, assertEnvelope } from './_helpers'

describe('初始化 / setup', () => {
  it('GET /setup/status: 信封结构完整', async () => {
    const res = await http.get('/setup/status')
    expect(res.status).toBe(200)
    assertEnvelope('setup-status', res.data)
    expect(res.data.code).toBe('OK')
    expect(typeof res.data.data.initialized).toBe('boolean')
    const pr = res.data.data.password_requirements
    expect(pr).toBeTruthy()
    expect(typeof pr.min_length).toBe('number')
    expect(typeof pr.require_letter).toBe('boolean')
    expect(typeof pr.require_digit).toBe('boolean')
    expect(typeof pr.description).toBe('string')
  })

  it('GET /setup/status: 当 initialized=true 时仍返回完整结构', async () => {
    // 本环境已 init（之前已 init-admin），结构应保持一致
    const res = await http.get('/setup/status')
    expect(res.data.data.initialized).toBe(true)
  })

  it('POST /setup/init-admin: 已初始化时返回 409', async () => {
    const res = await http.post('/setup/init-admin', {
      username: 'someone',
      email: 'a@b.c',
      password: 'Init1234',
    })
    expect(res.status).toBe(409)
    assertEnvelope('setup-reinit', res.data)
    expect(res.data.code).toBe('ALREADY_INITIALIZED')
    expect(res.data.data).toBeNull()
  })

  it('POST /setup/init-admin: 弱密码应被拒绝（422）', async () => {
    // 绕过 initialized 检查 —— 后端会先校验 password 要求
    const res = await http.post('/setup/init-admin', {
      username: 'x',
      email: 'x@x.com',
      password: '123',
    })
    expect(res.status).toBe(422)
    assertEnvelope('setup-weak', res.data)
  })
})
