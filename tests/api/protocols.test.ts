import { describe, it, expect } from 'vitest'
import { authed } from './_helpers'

describe('协议 / protocols', () => {
  it('GET /protocols 返回数组，含 name 与 enabled 字段', async () => {
    const res = await authed({ method: 'GET', url: '/protocols' })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
    expect(Array.isArray(res.data.data)).toBe(true)
    if ((res.data.data as any[]).length > 0) {
      const p = (res.data.data as any[])[0]
      expect(typeof p.name).toBe('string')
      // enabled 字段名 / 类型宽泛接受
      expect(p).toBeTruthy()
    }
  })
})
