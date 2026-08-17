import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, pageItems } from './_helpers'

describe('通道 / channels', () => {
  let pid: number, did: number, sid: number, cid: number

  beforeAll(async () => {
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('c-proj') } })
    pid = p.data.data!.id as number
    const d = await authed({
      method: 'POST',
      url: '/devices',
      data: { project_id: pid, device_code: uniq('c-dev'), protocol: 'mqtt' },
    })
    did = d.data.data!.id as number
    const s = await authed({
      method: 'POST',
      url: '/sensors',
      data: { device_id: did, sensor_code: uniq('c-snr') },
    })
    sid = s.data.data!.id as number
    const c = await authed({
      method: 'POST',
      url: '/channels',
      data: { sensor_id: sid, channel_code: uniq('ch'), unit: 'mm/s', axis: 'x' },
    })
    expect(c.status).toBe(201)
    cid = c.data.data!.id as number
  })

  afterAll(async () => {
    if (cid) await authed({ method: 'DELETE', url: `/channels/${cid}` })
    if (sid) await authed({ method: 'DELETE', url: `/sensors/${sid}` })
    if (did) await authed({ method: 'DELETE', url: `/devices/${did}` })
    if (pid) await authed({ method: 'DELETE', url: `/projects/${pid}` })
  })

  it('GET /channels/{id} 含 channel_code / sensor_id / axis / unit', async () => {
    const res = await authed({ method: 'GET', url: `/channels/${cid}` })
    expect(res.status).toBe(200)
    const c = res.data.data
    expect(c.id).toBe(cid)
    expect(c.sensor_id).toBe(sid)
    expect(c.unit).toBe('mm/s')
    expect(c.axis).toBe('x')
  })

  it('GET /channels?sensor_id=X 过滤生效', async () => {
    const res = await authed({ method: 'GET', url: '/channels', params: { sensor_id: sid } })
    expect(res.status).toBe(200)
    expect(pageItems(res.data.data).some((c: any) => c.id === cid)).toBe(true)
  })

  it('POST alert_rules 可接受数组并回显', async () => {
    const rules = [{ level: 'warning', operator: 'gt', threshold: 5.0 }]
    const res = await authed({
      method: 'POST',
      url: '/channels',
      data: { sensor_id: sid, channel_code: uniq('ch-ar'), alert_rules: rules },
    })
    expect(res.status).toBe(201)
    expect(Array.isArray(res.data.data.alert_rules)).toBe(true)
    expect(res.data.data.alert_rules[0]).toMatchObject({
      level: 'warning',
      operator: 'gt',
      threshold: 5.0,
    })
    await authed({ method: 'DELETE', url: `/channels/${res.data.data.id}` })
  })

  it('PUT /channels/{id} 更新 unit', async () => {
    const res = await authed({
      method: 'PUT',
      url: `/channels/${cid}`,
      data: { unit: 'g' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.unit).toBe('g')
  })

  it('POST 缺 sensor_id → 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/channels',
      data: { channel_code: uniq('ch-422') },
    })
    expect(res.status).toBe(422)
  })

  it('GET 不存在 id → 404', async () => {
    const res = await authed({ method: 'GET', url: '/channels/9999999' })
    expect(res.status).toBe(404)
  })
})
