/**
 * 角色权限 / 资源级权限边界测试。
 *
 * 校准目标（2026-08-17）：
 *   - role=user 调任何受保护端点应返 HTTP 403 + 信封
 *     { code: "FORBIDDEN", message, data: null, timestamp }
 *   - 当前实测后端是 HTTP 404 + code:"NOT_FOUND"，即 SHM-API-001
 *     尚未真正修复，本测试全部为红灯，直到 001 落地。
 *
 * 一旦后端把 user 越权改为 403 + FORBIDDEN 信封，本文件
 * 全部自动转绿 —— 这是"等修复"的活信号。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, authed, login, uniq } from './_helpers'

let adminToken: string
let userToken: string
let probeUserId: number
let pid: number, did: number, sid: number

beforeAll(async () => {
  // 用 admin 创建 user 账号（admin 不被强制有 admin-only 端点）
  const adminT = await login()
  adminToken = adminT.access

  const probeEmail = `${uniq('rbac')}@e.com`
  const probeName = uniq('rb')
  const created = await http.post<any>('/users', {
    username: probeName,
    email: probeEmail,
    password: 'Rb1234567',
    role: 'user',
  }, { headers: { Authorization: `Bearer ${adminToken}` } })
  expect(created.status).toBe(201)
  probeUserId = created.data.data!.id as number

  const ut = await login(probeName, 'Rb1234567')
  userToken = ut.access
  // sanity: token 解码含 role=user
  const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64url').toString('utf8'))
  expect(payload.role).toBe('user')

  // 准备项目 + 设备 + 传感器，作为资源级测试的锚点
  const p = await http.post<any>('/projects', { name: uniq('rb-p') },
    { headers: { Authorization: `Bearer ${adminToken}` } })
  pid = p.data.data!.id
  const d = await http.post<any>('/devices',
    { project_id: pid, device_code: uniq('rb-d'), protocol: 'mqtt' },
    { headers: { Authorization: `Bearer ${adminToken}` } })
  did = d.data.data!.id
  const s = await http.post<any>('/sensors',
    { device_id: did, sensor_code: uniq('rb-s') },
    { headers: { Authorization: `Bearer ${adminToken}` } })
  sid = s.data.data!.id
})

afterAll(async () => {
  if (sid) await http.delete(`/sensors/${sid}`, { headers: { Authorization: `Bearer ${adminToken}` } })
  if (did) await http.delete(`/devices/${did}`, { headers: { Authorization: `Bearer ${adminToken}` } })
  if (pid) await http.delete(`/projects/${pid}`, { headers: { Authorization: `Bearer ${adminToken}` } })
  if (probeUserId) await http.delete(`/users/${probeUserId}`, { headers: { Authorization: `Bearer ${adminToken}` } })
})

function withUser(config: any = {}) {
  return {
    ...config,
    headers: { ...(config.headers ?? {}), Authorization: `Bearer ${userToken}` },
  }
}

describe('RBAC: user 角色对受保护端点的访问', () => {
  // 期望：所有 user-only 越权场景返回
  //   HTTP 403 + 信封 { code: "FORBIDDEN", message: "...", data: null, timestamp }
  // 当前（待后端修复 SHM-API-001）：仍是 HTTP 404 + code:"NOT_FOUND"
  // 这部分用例的红灯是"等 SHM-API-001 真正修复"的活信号。
  const expectForbidden = async (config: any, label: string) => {
    const res = await http.request(config)
    expect(res.status, `${label} HTTP`).toBe(403)
    expect(res.data, `${label} envelope`).toBeTruthy()
    expect(res.data.code, `${label} code`).toBe('FORBIDDEN')
    expect(res.data.data, `${label} data=null`).toBeNull()
    expect(typeof res.data.message).toBe('string')
    expect(typeof res.data.timestamp).toBe('string')
  }

  it('user GET /projects 可读自己可见的项目列表（不是 admin-only）', async () => {
    const res = await http.request(withUser({ method: 'GET', url: '/projects' }))
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
  })

  it('user POST /projects 被拒', async () => {
    await expectForbidden(withUser({ method: 'POST', url: '/projects', data: { name: 'x' } }), 'POST /projects')
  })

  it('user PUT /projects/{id} 被拒', async () => {
    await expectForbidden(withUser({ method: 'PUT', url: `/projects/${pid}`, data: { description: 'x' } }), 'PUT /projects')
  })

  it('user DELETE /projects/{id} 被拒', async () => {
    await expectForbidden(withUser({ method: 'DELETE', url: `/projects/${pid}` }), 'DELETE /projects')
  })

  it('user POST /devices 被拒', async () => {
    await expectForbidden(withUser({
      method: 'POST', url: '/devices',
      data: { project_id: pid, device_code: 'rb-new', protocol: 'mqtt' },
    }), 'POST /devices')
  })

  it('user GET /users 被拒', async () => {
    await expectForbidden(withUser({ method: 'GET', url: '/users' }), 'GET /users')
  })

  it('user POST /users 被拒', async () => {
    await expectForbidden(withUser({
      method: 'POST', url: '/users',
      data: { username: 'x', email: 'x@y.com', password: 'Abcd1234' },
    }), 'POST /users')
  })

  it('user POST /users/{id}/password 被拒', async () => {
    await expectForbidden(withUser({
      method: 'POST', url: `/users/${probeUserId}/password`,
      data: { new_password: 'Newpass1234' },
    }), 'POST /users/.../password')
  })

  it('user PUT /platform 被拒（OpenAPI 声明"仅 admin 可改"）', async () => {
    await expectForbidden(withUser({
      method: 'PUT', url: '/platform',
      data: { platform_name: 'hijack' },
    }), 'PUT /platform')
  })

  it('user GET /alerts 可读（不是 admin-only，user 应当能看自己项目的告警）', async () => {
    const res = await http.request(withUser({ method: 'GET', url: '/alerts' }))
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
  })

  it('user GET /protocols 可读（协议目录是公共知识）', async () => {
    const res = await http.request(withUser({ method: 'GET', url: '/protocols' }))
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
  })

  it('user POST /alerts/{nonexistent}/acknowledge 应受限（权限检查应在资源查找之前）', async () => {
    const res = await http.request(withUser({
      method: 'POST', url: '/alerts/9999999/acknowledge',
    }))
    // 后端先做权限拒绝再找资源 —— 期望 403 + FORBIDDEN
    // 当前（待修）：先查 alert 不存在返回 404
    expect(res.status).toBe(403)
    expect(res.data?.code).toBe('FORBIDDEN')
    expect(res.data?.data).toBeNull()
  })
})

describe('RBAC: 资源级授权', () => {
  it('未授权 user GET /projects/{id} 应受限（资源级）', async () => {
    // 该 user 没被分配到 pid 这个项目
    const res = await http.request(withUser({ method: 'GET', url: `/projects/${pid}` }))
    // 同样期望 403 + FORBIDDEN 信封
    expect(res.status).toBe(403)
    expect(res.data?.code).toBe('FORBIDDEN')
    expect(res.data?.data).toBeNull()
  })
})

describe('RBAC: admin 自身的 CRUD 仍然可用（回归）', () => {
  it('admin GET /projects 全量可见（含未分配的）', async () => {
    const res = await authed({ method: 'GET', url: '/projects' })
    expect(res.status).toBe(200)
    expect(res.data.code).toBe('OK')
  })

  it('admin GET /users 含普通用户', async () => {
    const res = await authed({ method: 'GET', url: '/users' })
    expect(res.status).toBe(200)
    const items = (res.data.data as any).items ?? res.data.data
    expect(Array.isArray(items)).toBe(true)
    expect(items.some((u: any) => u.id === probeUserId)).toBe(true)
  })

  it('admin PUT /platform 可改', async () => {
    const before = await authed({ method: 'GET', url: '/platform' })
    const name = before.data.data.platform_name ?? 'SHM Platform'
    const upd = await authed({ method: 'PUT', url: '/platform', data: { platform_name: name } })
    expect(upd.status).toBe(200)
  })

  it('admin POST /projects/{id}/users 分配资源', async () => {
    const res = await http.post(`/projects/${pid}/users`,
      { user_id: probeUserId, role: 'viewer' },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    expect(res.status).toBe(204)
  })
})
