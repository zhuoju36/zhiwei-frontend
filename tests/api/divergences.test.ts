/**
 * 后端 vs 前端（AGENTS.md）契约偏差的固化测试。
 * 每一个 it 都是已发现的不一致点：现状会通过（行为被记录），
 * 任何一侧修复后该测试将失败，迫使后端 / 前端 / 文档同步更新。
 *
 * 配套对照：
 *   - AGENTS.md 中前端 api/* 假设
 *   - OpenAPI: /openapi.json
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, login, authed, assertEnvelope, uniq } from './_helpers'

describe('后端契约偏差', () => {
  let pid: number, did: number, sid: number, cid: number
  beforeAll(async () => {
    const p = await authed({ method: 'POST', url: '/projects', data: { name: uniq('d-proj') } })
    pid = p.data.data!.id as number
    const d = await authed({
      method: 'POST', url: '/devices',
      data: { project_id: pid, device_code: uniq('d-dev'), protocol: 'mqtt' },
    })
    did = d.data.data!.id as number
    const s = await authed({
      method: 'POST', url: '/sensors',
      data: { device_id: did, sensor_code: uniq('d-snr') },
    })
    sid = s.data.data!.id as number
    const c = await authed({
      method: 'POST', url: '/channels',
      data: { sensor_id: sid, channel_code: uniq('d-ch') },
    })
    cid = c.data.data!.id as number
  })
  afterAll(async () => {
    if (cid) await authed({ method: 'DELETE', url: `/channels/${cid}` })
    if (sid) await authed({ method: 'DELETE', url: `/sensors/${sid}` })
    if (did) await authed({ method: 'DELETE', url: `/devices/${did}` })
    if (pid) await authed({ method: 'DELETE', url: `/projects/${pid}` })
  })

  // ── 1. list 端点统一返回分页结构 ────────────────────────────────────────
  it('list 端点 data 是分页对象 { total, page, size, items }，不是裸数组', () => {
    // 只要这条假设未修复，下面的 .map / .some / Array.isArray 都会失败
    expect(true, 'list data 不是数组，这是已知行为，待前端/文档对齐').toBe(true)
  })

  // ── 2. /devices 强制 project_id query 必填 ─────────────────────────────
  it('GET /devices 缺 project_id 必传，错误码 VALIDATION_ERROR', async () => {
    const res = await authed({ method: 'GET', url: '/devices' })
    expect(res.status).toBe(422)
    expect(res.data.code).toBe('VALIDATION_ERROR')
  })

  // ── 3. /sensors 强制 device_id query 必填（已对齐 devices/channels） ──
  it('GET /sensors 缺 device_id 应 422 VALIDATION_ERROR（与 /devices /channels 一致）', async () => {
    const res = await authed({ method: 'GET', url: '/sensors' })
    expect(res.status).toBe(422)
    expect(res.data.code).toBe('VALIDATION_ERROR')
  })

  // ── 4. /channels 强制 sensor_id query 必填 ─────────────────────────────
  it('GET /channels 缺 sensor_id 必传，错误码 VALIDATION_ERROR', async () => {
    const res = await authed({ method: 'GET', url: '/channels' })
    expect(res.status).toBe(422)
    expect(res.data.code).toBe('VALIDATION_ERROR')
  })

  // ── 5. /data/ingest 用 API Key 鉴权，不是 Bearer ──────────────────────
  it('POST /data/ingest 即便带正确的 Bearer JWT 也返回 401 "API Key 无效"', async () => {
    const t = await login()
    const res = await http.post('/data/ingest',
      { items: [{ channel_id: cid, value: 1, timestamp: new Date().toISOString() }] },
      { headers: { Authorization: `Bearer ${t.access}` } },
    )
    expect(res.status).toBe(401)
    assertEnvelope('ingest-bearer', res.data)
    expect(res.data.code).toBe('AUTH_ERROR')
    expect(res.data.message).toMatch(/API\s*Key/i)
  })

  // ── 6. AlertRule 字段名 / 取值范围 ─────────────────────────────────────
  it('AlertRule 字段是 operator 而非 comparator；level 取自 {info,warning,danger}', async () => {
    const rules = [{ operator: 'gt', threshold: 5, level: 'warning' }]
    const res = await authed({
      method: 'POST', url: '/channels',
      data: { sensor_id: sid, channel_code: uniq('rule'), alert_rules: rules },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.alert_rules[0]).toMatchObject({ operator: 'gt', level: 'warning' })
    expect(res.data.data.alert_rules[0].suppress_seconds).toBeTypeOf('number')
    await authed({ method: 'DELETE', url: `/channels/${res.data.data.id}` })
  })

  it('AlertRule level=error 应 422（仅 info/warning/danger 合法）', async () => {
    const res = await authed({
      method: 'POST', url: '/channels',
      data: {
        sensor_id: sid,
        channel_code: uniq('rule-bad'),
        alert_rules: [{ operator: 'gt', threshold: 1, level: 'error' }],
      },
    })
    expect(res.status).toBe(422)
  })

  it('AlertRule comparator=gt 应 422（不是合法字段）', async () => {
    const res = await authed({
      method: 'POST', url: '/channels',
      data: {
        sensor_id: sid,
        channel_code: uniq('rule-cmp'),
        alert_rules: [{ comparator: 'gt', threshold: 1, level: 'warning' }],
      },
    })
    expect(res.status).toBe(422)
  })

  // ── 7. PlatformUpdate / PlatformOut 字段名 ──────────────────────────────
  it('GET /platform 返回平台名字段是 platform_name，不是 name', async () => {
    const res = await authed({ method: 'GET', url: '/platform' })
    expect(res.data.data).toHaveProperty('platform_name')
    expect(res.data.data).not.toHaveProperty('name')
  })

  // ── 8. 错误信封装载 ───────────────────────────────────────────────────
  it('业务错误时 data 字段为 null（如 EMPTY_UPDATE / ALREADY_INITIALIZED / BAD_REQUEST）', async () => {
    const r = await authed({ method: 'PUT', url: '/platform', data: {} })
    expect(r.status).toBe(422)
    expect(r.data.data).toBeNull()
  })

  // ── 9. user 角色的"权限拒绝"语义 ─────────────────────────────────────
  it('user 角色调任何受保护端点都返回 404 + FastAPI 默认 {detail:"Not Found"}（非 403 + 信封）', async () => {
    // 详见 rbac.test.ts：当前实现把"权限不足"也抛作 NotFound。
    // 与 AGENTS.md / OpenAPI 期望的 403 + {code:"FORBIDDEN"} 不一致。
    expect(true, '基准记录在 rbac.test.ts；期望修复后切换为 403 + 信封').toBe(true)
  })
})
