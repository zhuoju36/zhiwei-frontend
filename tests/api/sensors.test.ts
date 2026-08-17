import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, pageItems } from './_helpers'

describe('传感器 / sensors', () => {
  let pid: number, did: number, sid: number

  beforeAll(async () => {
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('s-proj') } })
    pid = p.data.data!.id as number
    const d = await authed({
      method: 'POST',
      url: '/devices',
      data: { project_id: pid, device_code: uniq('s-dev'), protocol: 'mqtt' },
    })
    did = d.data.data!.id as number

    const s = await authed({
      method: 'POST',
      url: '/sensors',
      data: { device_id: did, sensor_code: uniq('snr'), sensor_type: '加速度计' },
    })
    expect(s.status).toBe(201)
    sid = s.data.data!.id as number
  })

  afterAll(async () => {
    if (sid) await authed({ method: 'DELETE', url: `/sensors/${sid}` })
    if (did) await authed({ method: 'DELETE', url: `/devices/${did}` })
    if (pid) await authed({ method: 'DELETE', url: `/projects/${pid}` })
  })

  it('GET /sensors/{id} 返回 sensor_code 与 device_id', async () => {
    const res = await authed({ method: 'GET', url: `/sensors/${sid}` })
    expect(res.status).toBe(200)
    expect(res.data.data.id).toBe(sid)
    expect(res.data.data.device_id).toBe(did)
  })

  it('GET /sensors?device_id=X 过滤生效', async () => {
    const res = await authed({ method: 'GET', url: '/sensors', params: { device_id: did } })
    expect(res.status).toBe(200)
    const ids = pageItems<{ id: number }>(res.data.data).map((s) => s.id)
    expect(ids).toContain(sid)
  })

  it('POST position={x,y,z} 应被接受并返回', async () => {
    const res = await authed({
      method: 'POST',
      url: '/sensors',
      data: {
        device_id: did,
        sensor_code: uniq('snr-xyz'),
        position: { x: 1.5, y: 2.5, z: 3.5 },
      },
    })
    expect(res.status).toBe(201)
    const pos = res.data.data.position
    expect(pos).toBeTruthy()
    expect([pos.x, pos.y, pos.z]).toEqual([1.5, 2.5, 3.5])
    // 清理
    await authed({ method: 'DELETE', url: `/sensors/${res.data.data.id}` })
  })

  it('PUT /sensors/{id} 部分更新 sensor_name', async () => {
    const res = await authed({
      method: 'PUT',
      url: `/sensors/${sid}`,
      data: { sensor_name: 'updated-name' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.sensor_name).toBe('updated-name')
  })

  it('POST 缺 device_id → 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/sensors',
      data: { sensor_code: uniq('no-device') },
    })
    expect(res.status).toBe(422)
  })

  it('GET 不存在 id → 404', async () => {
    const res = await authed({ method: 'GET', url: '/sensors/9999999' })
    expect(res.status).toBe(404)
  })
})
