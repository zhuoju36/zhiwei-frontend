import { describe, it, expect } from 'vitest'
import { authed, pageItems } from './_helpers'

describe('告警 / alerts', () => {
  it('GET /alerts 列表可访问', async () => {
    const res = await authed({ method: 'GET', url: '/alerts' })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
    expect(Array.isArray(pageItems(res.data.data))).toBe(true)
  })

  it('GET /alerts 不存在 id 行为', async () => {
    const res = await authed({ method: 'GET', url: '/alerts/9999999' })
    expect([404, 422]).toContain(res.status)
  })

  it('POST /alerts/{id}/acknowledge 不存在 id 行为', async () => {
    const res = await authed({ method: 'POST', url: '/alerts/9999999/acknowledge' })
    expect([404, 422]).toContain(res.status)
  })
})
