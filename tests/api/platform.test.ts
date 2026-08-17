import { describe, it, expect } from 'vitest'
import { authed, assertEnvelope } from './_helpers'

describe('平台 / platform', () => {
  it('GET /platform 200 + object data', async () => {
    const res = await authed({ method: 'GET', url: '/platform' })
    expect(res.status).toBe(200)
    assertEnvelope('platform', res.data)
    expect(typeof res.data.data).toBe('object')
    expect(res.data.data).not.toBeNull()
  })

  it('PUT /platform 接受 platform_name 之类的更新', async () => {
    const before = await authed({ method: 'GET', url: '/platform' })
    const name = before.data.data?.platform_name ?? 'SHM Platform'
    const res = await authed({
      method: 'PUT',
      url: '/platform',
      data: { platform_name: `${name} (test)` },
    })
    expect(res.status).toBe(200)
    // 还原
    await authed({ method: 'PUT', url: '/platform', data: { platform_name: name } })
  })

  it('PUT /platform 空 body 返回 422 EMPTY_UPDATE', async () => {
    const res = await authed({ method: 'PUT', url: '/platform', data: {} })
    expect(res.status).toBe(422)
    expect(res.data.code).toBe('EMPTY_UPDATE')
    expect(res.data.data).toBeNull()
  })
})
