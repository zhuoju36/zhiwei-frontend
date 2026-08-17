import { describe, it, expect, beforeAll } from 'vitest'
import { authed, uniq, assertEnvelope, pageItems } from './_helpers'

describe('子项 / projects', () => {
  let pid: number

  beforeAll(async () => {
    const res = await authed({
      method: 'POST',
      url: '/projects',
      data: { name: uniq('proj'), description: 'api-test' },
    })
    expect(res.status).toBe(201)
    assertEnvelope('project-create', res.data)
    expect(typeof res.data.data.id).toBe('number')
    pid = res.data.data.id
  })

  it('CRUD: create → list 可见 → get 一致 → update 生效 → delete', async () => {
    const created = await authed({
      method: 'POST',
      url: '/projects',
      data: { name: uniq('p') },
    })
    const id = created.data.data!.id as number

    const list = await authed({ method: 'GET', url: '/projects' })
    expect(list.status).toBe(200)
    expect(pageItems(list.data.data).some((p: any) => p.id === id)).toBe(true)

    const get = await authed({ method: 'GET', url: `/projects/${id}` })
    expect(get.status).toBe(200)
    expect(get.data.data.id).toBe(id)

    const upd = await authed({
      method: 'PUT',
      url: `/projects/${id}`,
      data: { description: 'updated' },
    })
    expect(upd.status).toBe(200)
    expect(upd.data.data.description).toBe('updated')

    const del = await authed({ method: 'DELETE', url: `/projects/${id}` })
    expect(del.status).toBe(204)
  })

  it('GET 不存在的 id 返回 404', async () => {
    const res = await authed({ method: 'GET', url: '/projects/9999999' })
    expect(res.status).toBe(404)
    assertEnvelope('project-404', res.data)
  })

  it('DELETE 不存在的 id 返回 404（推测）', async () => {
    const res = await authed({ method: 'DELETE', url: '/projects/9999999' })
    expect([404, 422]).toContain(res.status)
  })

  it('create 缺必填 name 返回 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/projects',
      data: { description: 'no name' },
    })
    expect(res.status).toBe(422)
    assertEnvelope('project-422', res.data)
  })

  it('重复同名是否被拒绝（由后端唯一性决定）', async () => {
    const name = uniq('dup')
    const a = await authed({ method: 'POST', url: '/projects', data: { name } })
    expect(a.status).toBe(201)
    const b = await authed({ method: 'POST', url: '/projects', data: { name } })
    if (b.status === 409 || b.status === 422) {
      expect([409, 422]).toContain(b.status)
      assertEnvelope('project-dup', b.data)
    } else {
      // 后端允许同名：记录实际行为供后续参考
      expect([201, 200]).toContain(b.status)
    }
    // 清理 a 和 b
    await authed({ method: 'DELETE', url: `/projects/${a.data.data.id}` })
    if (b.data?.data?.id) {
      await authed({ method: 'DELETE', url: `/projects/${b.data.data.id}` })
    }
  })

  it('cleanup: 删除 beforeAll 创建的项目', async () => {
    const res = await authed({ method: 'DELETE', url: `/projects/${pid}` })
    expect([204, 404]).toContain(res.status)
  })

  it('DELETE 含设备但无 sensor 的项目应 204（验收 SHM-API-003-R）', async () => {
    // 1. 建项目
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('p-with-dev') } })
    const pidNew = p.data.data!.id as number

    // 2. 在该项目下建一个设备，不建 sensor/channel
    const d = await authed({
      method: 'POST', url: '/devices',
      data: { project_id: pidNew, device_code: uniq('dev'), protocol: 'mqtt' },
    })
    expect(d.status).toBe(201)
    const did = d.data.data!.id as number

    // 3. 删项目，应 204（之前这条路径会 500）
    const del = await authed({ method: 'DELETE', url: `/projects/${pidNew}` })
    expect(del.status).toBe(204)

    // 4. 设备应被级联清理（GET 返 404，行为由后端决定）
    const check = await authed({ method: 'GET', url: `/devices/${did}` })
    expect([404, 422]).toContain(check.status)
  })
})
