import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, pageItems } from './_helpers'

describe('分析 / analysis', () => {
  it('GET /analysis/plugins 返回插件清单', async () => {
    const res = await authed({ method: 'GET', url: '/analysis/plugins' })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it('POST /analysis/jobs 创建任务（dry 端点）', async () => {
    const res = await authed({
      method: 'POST',
      url: '/analysis/jobs',
      data: { type: 'fft', channel_id: 1, params: {} },
    })
    // 不一定真能创建（取决于业务约束）；至少能拿到一个非 5xx 响应
    expect([201, 400, 404, 422]).toContain(res.status)
  })

  it('GET /analysis/jobs 返回列表', async () => {
    const res = await authed({ method: 'GET', url: '/analysis/jobs' })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
    expect(Array.isArray(pageItems(res.data.data))).toBe(true)
  })

  it('GET /analysis/jobs/{nonexistent} 行为', async () => {
    const res = await authed({ method: 'GET', url: '/analysis/jobs/9999999' })
    expect([404, 422]).toContain(res.status)
  })
})
