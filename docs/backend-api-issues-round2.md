# 后端 API 契约 Issue（第二轮 · 提交后端）

> **编写人**：前端 SHM 项目组
> **日期**：2026-08-17（基于 8000 端口 + 已重置 users 表环境）
> **第一轮状态**：001/002/004/005/006 全部通过前端测试验收
> **本轮范围**：第一轮遗漏的两条子问题 + 任何后端在第二轮顺手发现的新问题

## 0. 第一轮验收回顾

| Issue | 描述 | 验收方式 | 结果 |
|---|---|---|---|
| SHM-API-001 | user 越权应 403 + 信封 | `tests/api/rbac.test.ts` | 11/11 admin-only 写操作通过 |
| SHM-API-001-余 | 资源不存在 vs 权限不足应区分（不存在的资源也返 403） | `tests/api/rbac.test.ts > user POST /alerts/9999999/acknowledge` | ❌ 仍 404 |
| SHM-API-002 | 错误一律走信封 | `tests/api/setup.test.ts data.test.ts auth.test.ts` | ✅ |
| SHM-API-004 | LoginResponse 含 role/is_active | `tests/api/auth.test.ts` | ✅（含 user_id/username/email/role/is_active） |
| SHM-API-005 | /sensors 缺 device_id 错误码与 /devices 一致 | `tests/api/divergences.test.ts L57` | ✅ |
| SHM-API-006 | OpenAPI 安全方案命名 APIKeyHeader | `tests/api/divergences.test.ts ingest-bearer` | ✅ |

仍然保留的两条遗留见下面。

---

## SHM-API-003-R · `DELETE /projects/{id}` 在"含设备无 sensor"状态仍 500

**严重度**：🔴 高（阻塞前端项目删除）
**第一轮状态**：✅ 已修主路径（空项目 / 含 sensor / 含 channel 三种 → 204），但遗留一条孤立路径

### 复现

```bash
ADMIN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d 'username=admin&password=Admin1234' | jq -r .data.access_token)

PID=$(curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://localhost:8000/api/v1/projects -d '{"name":"repro-003"}' | jq -r .data.id)

# 只建设备，不建 sensor / channel
curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://host/api/v1/devices \
  -d "{\"project_id\":$PID,\"device_code\":\"D\",\"protocol\":\"mqtt\"}" >/dev/null

# 当前会 500；期望 204
curl -i -X DELETE -H "Authorization: Bearer $ADMIN" http://host/api/v1/projects/$PID
# HTTP/1.1 500 Internal Server Error
# {"code":"INTERNAL_ERROR","message":"服务器内部错误","data":null,"timestamp":"..."}
```

| 前置状态 | 当前 | 期望 |
|---|---|---|
| 空项目 | ✅ 204 | 204 |
| 项目 + 设备（无 sensor） | ❌ 500 | 204 |
| 项目 + 设备 + sensor | ✅ 204 | 204 |
| 项目 + 设备 + sensor + channel | ✅ 204 | 204 |

### 建议排查

- 在 `ProjectService.delete` / 对应 CRUD 删除项目中，删项目前应级联处理 device/sensor/channel，但当项目有 device 但无 sensor 时，可能踩到 channel 等中间态的约束
- 推荐：把项目级删除放在单一事务里，先解除所有资源关联再删项目；或用 ON DELETE CASCADE / SET NULL 处理 device 这种中间态

### 前端验证

修通后我会再跑 `pnpm vitest run tests/api/rbac.test.ts` 与 `projects.test.ts` 看是否清零；如果仍残留会在 `tests/api/projects.test.ts` 补一条专门覆盖"项目+设备"中间态的用例。

---

## SHM-API-001-R · 资源不存在与权限不足应区分（中间件顺序）

**严重度**：🟡 中（影响前端错误提示精度）
**第一轮状态**：⚠️ 已知遗留。第一轮修的是显式 admin-only 端点会返 403 + FORBIDDEN 信封。但仍存在一个反模式：**对不存在的资源用低权限账号发 admin-only 操作时，先返回 404 NOT_FOUND（资源不存在），而不是 403 FORBIDDEN（权限不足）**。

### 复现

```bash
USER=$(curl -s -X POST http://host/api/v1/auth/login \
  -d 'username=some_user&password=...' | jq -r .data.access_token)

# 用 user token 调 admin-only 操作，对一个不存在的 alert
curl -i -X POST -H "Authorization: Bearer $USER" \
  http://host/api/v1/alerts/9999999/acknowledge
# 当前：HTTP 404 + {"code":"NOT_FOUND", "message":"Not Found", "data":null, ...}
# 期望：HTTP 403 + {"code":"FORBIDDEN", "message":"...admin...", "data":null, ...}
```

### 期望

权限检查应先于资源存在性检查。这是更标准的 REST 语义：
- "你没有权限知道这个资源是否存在"
- 避免泄露资源枚举漏洞（attacker 不能用 401/403/404 的差异枚举合法 alert id）

### 建议修法

- 把"权限/角色守卫"放在路由处理函数的依赖注入里（`Depends(require_role("admin"))`），让它先于资源 CRUD 操作执行
- 用 FastAPI 的 `dependencies=` 列表或 `Security(...)` 表达
- 资源级授权（user 对项目无访问权）同理：先鉴权后查资源

### 不在范围内的端点

- `GET /projects` 这类基于可见性的列表：仍按 200 返回"user 可见的项目"即可，不要改成 403
- 公开端点（`/protocols /setup/status`）：本来就 200，不动

### 前端验证

`tests/api/rbac.test.ts > user POST /alerts/9999999/acknowledge 应受限（权限检查应在资源查找之前）` 这条会从 404 转 403 后自动转绿。

---

## 1. 仍建议补充的（低优先级）

| Issue | 描述 | 建议 |
|---|---|---|
| SUG-001 | OpenAPI 在所有需要 admin 的端点的 `description` 中明确"需要 role=admin"，避免集成方疑惑 | `/users` CRUD、`POST /projects`、`DELETE /projects`、`POST /projects/{id}/users` 等 |
| SUG-002 | `/data/ingest` 的 description 已写"非 JWT"，建议补充一句 X-API-Key 的获取/分发流程说明（属于运维文档而非 OpenAPI schema） | 见 README "数据接入" |

## 2. 工作流

1. 后端按 SHM-API-003-R → 001-R 顺序修
2. 修完后我会跑 `pnpm vitest run tests/api`，相关 rbac/projects 用例会从红转绿
3. 这次不要附带改 envelope 字段或 page shape，会破坏前端测试
4. 重 PR 大小控制在 100~200 行内

## 3. 联系方式

- 测试运行：`pnpm vitest run tests/api`
- 报告文件：`docs/backend-api-issues-round2.md`
- 第一轮报告：`docs/backend-api-issues.md`
- 前端相关代码：
  - `src/stores/user.ts`（等本轮后改用 LoginResponse 字段）
  - `src/types/channel.ts:AlertRule`（已与契约对齐，**不要再改**）
  - `src/types/platform.ts:PlatformInfo.platform_name`（已对齐，**不要再改**）
