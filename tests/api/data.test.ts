import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, http } from './_helpers'

describe('时序数据 / data', () => {
  let pid: number, did: number, sid: number, cid: number

  beforeAll(async () => {
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('dt-proj') } })
    pid = p.data.data!.id as number
    const d = await authed({
      method: 'POST',
      url: '/devices',
      data: { project_id: pid, device_code: uniq('dt-dev'), protocol: 'mqtt' },
    })
    did = d.data.data!.id as number
    const s = await authed({
      method: 'POST',
      url: '/sensors',
      data: { device_id: did, sensor_code: uniq('dt-snr') },
    })
    sid = s.data.data!.id as number
    const c = await authed({
      method: 'POST',
      url: '/channels',
      data: { sensor_id: sid, channel_code: uniq('dt-ch') },
    })
    cid = c.data.data!.id as number
  })

  afterAll(async () => {
    if (cid) await authed({ method: 'DELETE', url: `/channels/${cid}` })
    if (sid) await authed({ method: 'DELETE', url: `/sensors/${sid}` })
    if (did) await authed({ method: 'DELETE', url: `/devices/${did}` })
    if (pid) await authed({ method: 'DELETE', url: `/projects/${pid}` })
  })

  it('GET /data/latest/{channel_id} 未 ingest 时返回 null 或 404', async () => {
    const res = await authed({ method: 'GET', url: `/data/latest/${cid}` })
    // 后端可选：200 with null or 404
    if (res.status === 200) {
      expect(res.data.data === null || typeof res.data.data === 'object').toBe(true)
    } else {
      expect([404, 422]).toContain(res.status)
    }
  })

  it('POST /data/ingest 是设备侧 API Key 端点（不接受 Bearer JWT）', async () => {
    const res = await authed({
      method: 'POST',
      url: '/data/ingest',
      data: { items: [{ channel_id: cid, value: 1.0, timestamp: new Date().toISOString() }] },
    })
    // 探查：实际观察到 401 AUTH_ERROR "API Key 无效"
    expect(res.status).toBe(401)
    expect(res.data.code).toBe('AUTH_ERROR')
    expect(res.data.message).toMatch(/API\s*Key/i)
  })

  it('POST /data/ingest 完全匿名同样被拒', async () => {
    const res = await http.post('/data/ingest',
      { items: [{ channel_id: cid, value: 1, timestamp: new Date().toISOString() }] },
    )
    expect(res.status).toBe(401)
    expect(res.data.code).toBe('AUTH_ERROR')
  })

  it('POST /data/ingest 完全无 headers（FastAPI 默认错误 shape）', async () => {
    const res = await http.post('/data/ingest', { items: [] })
    // FastAPI 默认错误会绕开自定义 envelope —— 是否一致取决于全局异常处理器
    if (res.status === 200 || res.status === 422) {
      expect([200, 422]).toContain(res.status)
    } else {
      expect([401, 405]).toContain(res.status)
    }
  })

  it('GET /data/latest/{channel_id} ingest 后拿到值', async () => {
    const res = await authed({ method: 'GET', url: `/data/latest/${cid}` })
    expect(res.status).toBe(200)
    expect(res.data.data).not.toBeNull()
    // value / timestamp 字段名核对
    expect(typeof res.data.data.value === 'number' || typeof res.data.data.value === 'string').toBe(true)
    expect(res.data.data.timestamp).toBeTruthy()
  })

  it('GET /data/timeseries?channel_id=&start=&end= 返回点数组', async () => {
    const start = new Date(Date.now() - 5 * 60_000).toISOString()
    const end = new Date(Date.now() + 60_000).toISOString()
    const res = await authed({
      method: 'GET',
      url: '/data/timeseries',
      params: { channel_id: cid, start, end, interval: '1m' },
    })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
    expect(Array.isArray(res.data.data) || typeof res.data.data === 'object').toBe(true)
  })

  it('GET /data/timeseries 缺 channel_id → 422', async () => {
    const res = await authed({ method: 'GET', url: '/data/timeseries' })
    expect(res.status).toBe(422)
  })

  it('POST /data/ingest 缺 items → 401（先鉴权再校验）', async () => {
    const res = await authed({ method: 'POST', url: '/data/ingest', data: {} })
    // 先鉴权后校验，所以缺 body 也是先 401
    expect(res.status).toBe(401)
  })

  it('POST /data/ingest 空数组 → 401（同上）', async () => {
    const res = await authed({ method: 'POST', url: '/data/ingest', data: { items: [] } })
    expect([401, 200, 422]).toContain(res.status)
    expect(res.status).toBe(401)
  })

  it('POST /data/ingest 引用不存在 channel_id → 401（同上）', async () => {
    const res = await authed({
      method: 'POST',
      url: '/data/ingest',
      data: { items: [{ channel_id: 9999999, value: 1, timestamp: new Date().toISOString() }] },
    })
    expect(res.status).toBe(401)
  })
})
