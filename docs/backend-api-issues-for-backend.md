# 后端 API 契约 Issue · 给后端团队

> **来源**：前端 SHM 项目组
> **截止**：2026-08-17（基于 8000 端口 + admin/admin / Admin1234 凭据）
> **配套测试**：`tests/api/`（99 用例，每条 issue 都对应自动化活信号）

本文档只列**当前仍待修**的 issue。已修的不在此列。

---

## 总览

| 编号 | 严重度 | 标题 |
|---|---|---|
| **001-R** | 🟡 中 | 资源不存在 vs 权限不足应区分（中间件顺序） |
| **003-R** | 🔴 高 | `DELETE /projects/{id}` 在"项目含设备无 sensor"状态下仍 500 |

---

## 001-R · 资源不存在 vs 权限不足应区分（中间件顺序）

### 期望语义

权限检查应先于资源存在性检查。这避免通过 401/403/404 差异枚举合法 alert id：

| 场景 | 当前 | 期望 |
|---|---|---|
| user role 调 admin-only 写操作（如 `/alerts/{nonexistent}/acknowledge`） | 404 NOT_FOUND | **403 FORBIDDEN** |
| user role 调 admin-only 端点（资源存在） | ✅ 403 FORBIDDEN | 403 FORBIDDEN（已正确） |
| user role 调基于可见性的列表（`GET /projects`） | 200 OK | 200 OK（已正确） |
| 公开端点（`/protocols`、`/setup/status`） | 200 OK | 200 OK（已正确） |

### 复现

```bash
USER=$(curl -s -X POST http://host/api/v1/auth/login \
  -d 'username=some_user&password=...' | jq -r .data.access_token)

curl -i -X POST -H "Authorization: Bearer $USER" \
  http://host/api/v1/alerts/9999999/acknowledge
# 当前：HTTP 404 + {"code":"NOT_FOUND", "message":"Not Found", "data":null, ...}
# 期望：HTTP 403 + {"code":"FORBIDDEN", "message":"...admin...", "data":null, ...}
```

### 建议修法

- 把权限/角色守卫放在路由依赖注入层（`Depends(require_role("admin"))`），让它先于资源 CRUD 执行
- 资源级授权（user 对某项目无访问权）同理：先鉴权后查资源
- 不要把"权限不足"统一改为 404

### 前端验证

`tests/api/rbac.test.ts > user POST /alerts/9999999/acknowledge` 这条用例从 404 → 403 后自动转绿。

---

## 003-R · `DELETE /projects/{id}` 在"项目含设备无 sensor"状态下仍 500

### 复现

```bash
ADMIN=$(curl -s -X POST http://host/api/v1/auth/login \
  -d 'username=admin&password=Admin1234' | jq -r .data.access_token)

PID=$(curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://host/api/v1/projects -d '{"name":"repro-003"}' | jq -r .data.id)

# 只建设备，不建 sensor/channel
curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://host/api/v1/devices \
  -d "{\"project_id\":$PID,\"device_code\":\"D\",\"protocol\":\"mqtt\"}" >/dev/null

curl -i -X DELETE -H "Authorization: Bearer $ADMIN" http://host/api/v1/projects/$PID
# 当前：HTTP 500 + {"code":"INTERNAL_ERROR",...}
# 期望：HTTP 204
```

### 路径状态

| 前置状态 | 当前 | 期望 |
|---|---|---|
| 空项目 | ✅ 204 | 204 |
| 项目 + 设备（无 sensor） | ❌ 500 | 204 |
| 项目 + 设备 + sensor | ✅ 204 | 204 |
| 项目 + 设备 + sensor + channel | ✅ 204 | 204 |

### 建议排查

- 项目级删除应放在单一事务里：先解除所有资源关联（device / sensor / channel）再删项目
- 或者用 FK 级联 `ON DELETE CASCADE` / `SET NULL`
- 中间态"有设备无 sensor"踩到 channel 约束或 sensor 反向引用时容易 500

### 前端验证

修通后跑 `pnpm vitest run tests/api/projects.test.ts` 看是否清零；前端会在该文件补一条覆盖"项目+设备"中间态的用例。

---

## 工作流

1. 后端按 **001-R → 003-R** 顺序修，每条 PR 控制在 100~200 行
2. 修完后前端会跑 `pnpm vitest run tests/api` 与 `pnpm test:e2e`，相关用例从红转绿
3. 不要附带改 envelope 字段或 page shape，会破坏前端测试
4. 修完一轮告知前端，前端跑套件 + 收口报告

---

## 联系 / 测试入口

- 前端验证：`pnpm test:api`（99 用例）/ `pnpm test:e2e`
- 后端环境：8000 端口 + `admin / Admin1234`
- 仓库 commit 历史：见 `git log` 最近 5 条，含 `feat(stores/user)` / `docs(AGENTS)` / `test:` 等
- 历史 issue 文档：`docs/backend-api-issues.md`、`docs/backend-api-issues-round2.md`（两轮已修条目存档，仅供参考）