import { test, expect } from '@playwright/test'

/**
 * 登录 → 大屏 → Admin 入口可见性
 *
 * 环境前置：
 *   - 后端跑在 8000（vite proxy → 5173/api）
 *   - 后端已 init-admin，存在 user "admin / Admin1234"
 *
 * 跑命令：pnpm test:e2e （webServer 会复用已有的 vite dev）
 */

test.describe('登录 + 数据大屏 + Admin 入口', () => {
  test('未登录访问受保护路径会重定向到 /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    // 公开接口探测：平台名（来自 getPlatform，应能渲染）
    await expect(page.getByPlaceholder('用户名')).toBeVisible()
  })

  test('admin 登录后回到大屏，看到 Dashboard 关键卡片', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('Admin1234')
    await page.getByRole('button', { name: '登录' }).click()

    // 路由跳转到大屏（LoginResponse.role 决定能否进入）
    await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/dashboard', {
      timeout: 15_000,
    })

    // 大屏关键区块（来自 Dashboard/Index.vue）
    await expect(page.getByText('活跃告警')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('实时曲线')).toBeVisible()
  })

  test('admin 进入 /admin/users 看到用户列表（验证分页消费 + 角色守卫）', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('Admin1234')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.getByText('活跃告警')).toBeVisible({ timeout: 15_000 })

    // 直接访问 admin（路由守卫需要 token + role='admin'，验证 6.2 / 7.6）
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10_000 })

    // 顶部菜单（v-if="userStore.role === 'admin'"）出现，验证 SHM-API-001/004 落地
    await expect(page.getByRole('menuitem', { name: '系统管理' })).toBeVisible()

    // 侧栏进"用户管理"
    await expect(page.getByRole('menuitem', { name: '用户管理' }).first()).toBeVisible()

    // 列表表头 —— 验证 PageData<T> 消费 + Element Plus 表格渲染
    await expect(page.locator('th', { hasText: '用户名' })).toBeVisible()
    await expect(page.locator('th', { hasText: '邮箱' })).toBeVisible()
    await expect(page.locator('th', { hasText: '角色' })).toBeVisible()
  })

  test('admin 从 Admin 退出后回到 /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('Admin1234')
    await page.getByRole('button', { name: '登录' }).click()
    // 等登录落 store 再跳转；否则路由守卫可能把请求反弹回 /login
    await expect(page.getByText('活跃告警')).toBeVisible({ timeout: 15_000 })

    await page.goto('/admin/users')
    await expect(page.locator('th', { hasText: '用户名' })).toBeVisible({ timeout: 15_000 })

    // 顶部 AppHeader 上的"退出"按钮
    await page.locator('header .right').getByRole('button', { name: '退出' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
