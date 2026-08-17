import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, pageItems } from './_helpers'

describe('设备 / devices', () => {
  let pid: number
  let did: number

  beforeAll(async () => {
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('d-proj') } })
    pid = p.data.data!.id as number

    const d = await authed({
      method: 'POST',
      url: '/devices',
      data: {
        project_id: pid,
        device_code: uniq('dev'),
        device_name: 'test-device',
        protocol: 'mqtt',
      },
    })
    expect(d.status).toBe(201)
    did = d.data.data!.id as number
  })

  afterAll(async () => {
    if (did) await authed({ method: 'DELETE', url: `/devices/${did}` })
    if (pid) await authed({ method: 'DELETE', url: `/projects/${pid}` })
  })

  it('GET /devices/{id} 返回的字段应含 project_id / device_code / protocol', async () => {
    const res = await authed({ method: 'GET', url: `/devices/${did}` })
    expect(res.status).toBe(200)
    const d = res.data.data
    expect(d.id).toBe(did)
    expect(d.project_id).toBe(pid)
    expect(typeof d.device_code).toBe('string')
    expect(typeof d.protocol).toBe('string')
  })

  it('GET /devices?project_id=X 仅返回该项目下设备', async () => {
    const res = await authed({ method: 'GET', url: '/devices', params: { project_id: pid } })
    expect(res.status).toBe(200)
    const ids = pageItems<{ id: number }>(res.data.data).map((d) => d.id)
    expect(ids).toContain(did)
  })

  it('PUT /devices/{id} 更新 device_name', async () => {
    const res = await authed({
      method: 'PUT',
      url: `/devices/${did}`,
      data: { device_name: 'updated-name' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.device_name).toBe('updated-name')
  })

  it('POST /devices 缺必填 project_id 返回 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/devices',
      data: { device_code: uniq('x'), protocol: 'mqtt' },
    })
    expect(res.status).toBe(422)
  })

  it('POST /devices 缺必填 protocol 返回 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/devices',
      data: { project_id: pid, device_code: uniq('y') },
    })
    expect(res.status).toBe(422)
  })

  it('GET 不存在 id 应 404', async () => {
    const res = await authed({ method: 'GET', url: '/devices/9999999' })
    expect(res.status).toBe(404)
  })
})
