import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { authed, uniq, pageItems } from './_helpers'

describe('用户 / users', () => {
  let uid: number
  const username = uniq('user')

  beforeAll(async () => {
    const res = await authed({
      method: 'POST',
      url: '/users',
      data: { username, email: `${username}@e.com`, password: 'Init1234', role: 'user' },
    })
    expect(res.status).toBe(201)
    uid = res.data.data!.id as number
  })

  afterAll(async () => {
    if (uid) await authed({ method: 'DELETE', url: `/users/${uid}` })
  })

  it('GET /users 列表含刚才创建的用户', async () => {
    const res = await authed({ method: 'GET', url: '/users' })
    expect(res.status).toBe(200)
    expect(pageItems(res.data.data).some((u: any) => u.id === uid)).toBe(true)
  })

  it('GET /users/{id} 返回的字段不应含 password 明文', async () => {
    const res = await authed({ method: 'GET', url: `/users/${uid}` })
    expect(res.status).toBe(200)
    const u = res.data.data
    expect(u.id).toBe(uid)
    expect(u.password).toBeUndefined()
    expect(u.hashed_password).toBeUndefined()
  })

  it('PUT /users/{id} 可更新 email', async () => {
    const newEmail = `${username}-2@e.com`
    const res = await authed({
      method: 'PUT',
      url: `/users/${uid}`,
      data: { email: newEmail },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.email).toBe(newEmail)
  })

  it('POST /users/{id}/password 重置密码', async () => {
    const res = await authed({
      method: 'POST',
      url: `/users/${uid}/password`,
      data: { new_password: 'Reset1234' },
    })
    expect(res.status).toBe(204)
  })

  it('POST /users 弱密码 → 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/users',
      data: { username: uniq('weak'), email: 'w@w.com', password: '123' },
    })
    expect(res.status).toBe(422)
  })

  it('POST /users 邮箱不合法 → 422', async () => {
    const res = await authed({
      method: 'POST',
      url: '/users',
      data: { username: uniq('badem'), email: 'not-an-email', password: 'Init1234' },
    })
    expect(res.status).toBe(422)
  })

  it('POST /users 重复 username 行为（由后端决定）', async () => {
    const res = await authed({
      method: 'POST',
      url: '/users',
      data: { username, email: 'dup@e.com', password: 'Init1234' },
    })
    // 允许 409 / 422
    expect([409, 422, 201]).toContain(res.status)
    if (res.status === 201 && res.data?.data?.id) {
      await authed({ method: 'DELETE', url: `/users/${res.data.data.id}` })
    }
  })

  it('GET 不存在 id → 404', async () => {
    const res = await authed({ method: 'GET', url: '/users/9999999' })
    expect(res.status).toBe(404)
  })
})
