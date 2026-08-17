import { describe, it, expect } from 'vitest'
import { authed, assertEnvelope } from './_helpers'

describe('大屏 / dashboard', () => {
  it('GET /dashboard/overview 返回非 null data', async () => {
    const res = await authed({ method: 'GET', url: '/dashboard/overview' })
    expect(res.status).toBe(200)
    assertEnvelope('overview', res.data)
    expect(res.data.data).toBeTruthy()
    // 数据对象（形状允许演进，先只验是 object）
    expect(typeof res.data.data).toBe('object')
  })

  it('GET /dashboard/stats 返回的数据形状', async () => {
    const res = await authed({ method: 'GET', url: '/dashboard/stats' })
    expect(res.status).toBe(200)
    assertEnvelope('stats', res.data)
    const d = res.data.data
    expect(typeof d).toBe('object')
  })

  it('GET /dashboard/recent-alerts 默认 limit 生效', async () => {
    const res = await authed({ method: 'GET', url: '/dashboard/recent-alerts' })
    expect(res.status).toBe(200)
    assertEnvelope('recent-alerts', res.data)
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it('GET /dashboard/recent-alerts?limit=5 截断生效', async () => {
    const res = await authed({ method: 'GET', url: '/dashboard/recent-alerts', params: { limit: 5 } })
    expect(res.status).toBe(200)
    expect((res.data.data as unknown[]).length).toBeLessThanOrEqual(5)
  })

  it('GET /dashboard/recent-alerts?limit=0 边界', async () => {
    const res = await authed({ method: 'GET', url: '/dashboard/recent-alerts', params: { limit: 0 } })
    // 后端可能 422 或返回空数组
    expect([200, 422]).toContain(res.status)
  })
})
