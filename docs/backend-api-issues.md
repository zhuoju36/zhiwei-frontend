# 后端 API 契约 Issue 清单（交付给后端团队）

> **编写人**：前端 SHM 项目组
> **日期**：2026-08-17
> **关联测试**：`tests/api/rbac.test.ts`（角色权限）、`tests/api/divergences.test.ts`（契约偏差）。每条 issue 都给出了验证方式，后端修复后只需 `pnpm vitest run tests/api` 即可自动判定闭环。

## 0. 背景与目标

前端已为后端的所有公开/受保护端点（约 37 个 endpoint）写了 98 个 vitest 用例，覆盖 happy path、错误信封、必填校验、缺失 id、角色权限等。运行中发现 6 类契约不一致，影响前端 `request.ts` 拦截器、Pinia store、路由守卫、Admin 页表单提交。本文件是后续端修复工作的完整对齐清单。

**信封约定（生效中）**：所有业务接口的 JSON 响应都应是
```json
{ "code": "OK", "message": "...", "data": ..., "timestamp": "..." }
```
业务码：`OK`、`AUTH_ERROR`、`VALIDATION_ERROR`、`BAD_REQUEST`、`EMPTY_UPDATE`、`ALREADY_INITIALIZED`、`INTERNAL_ERROR` 等。出错时 `data` 必须为 `null`。

## 1. Issue 总览

| 编号 | 标题 | 严重度 | 自动验证 |
|---|---|---|---|
| SHM-API-001 | 角色越权应当返回 403 + 信封，而不是 404 + 裸 `{detail}` | 🔴 高 | `tests/api/rbac.test.ts` |
| SHM-API-002 | FastAPI 默认错误（404/405/500）必须走全局异常处理以返回信封 | 🔴 高 | `tests/api/divergences.test.ts` |
| SHM-API-003 | `DELETE /projects/{id}` 在"含设备但无 sensor"状态下报 500（残留路径） | 🔴 高 | （见 §5 复现脚本） |
| SHM-API-004 | `LoginResponse` 缺少 `role` 字段，前端需要解析 JWT 才能获取角色 | 🟡 中 | `tests/api/auth.test.ts` |
| SHM-API-005 | `/sensors` 缺 `device_id` 的错误码（400 BAD_REQUEST）与 `/devices`、`/channels` 的 422 VALIDATION_ERROR 不一致 | 🟡 中 | `tests/api/divergences.test.ts` L57 |
| SHM-API-006 | OpenAPI 中 `/api/v1/data/ingest` 的 `security` 为空，与实际"API Key 鉴权"不一致 | 🟢 低 | `tests/api/divergences.test.ts` ingest-bearer |

> 已修复（不要在本文件中重复提）：`DELETE /projects/{id}` 当项目为空 / 含 sensor / 含 channel 三种主路径 500。仍有 SHM-API-003 一条孤立的子情况。

---

## SHM-API-001 · 角色越权应返回 403 + 信封，而不是 404 + 裸 `{detail}`

**严重度**：🔴 高
**影响面**：所有 user-role 端点、所有受保护路由、整个前端 `request.ts` 错误展示

### 当前行为

用 `role=user` 的 access_token 调用任何一个受保护端点：

```bash
$ curl -H "Authorization: Bearer $USER_TOKEN" http://host/api/v1/users
HTTP/1.1 404 Not Found
{"detail":"Not Found"}
```

`/users`、`/projects`、`/platform`、`/alerts`、`/protocols`、`/sensors`、`/channels`、`/devices`、`/dashboard/*`、`/analysis/*`、`/data/*`（除 ingest）全部一致。

### 期望行为

```http
HTTP/1.1 403 Forbidden
{"code":"FORBIDDEN","message":"需要 admin 权限","data":null,"timestamp":"..."}
```

### 建议修法

1. 把"权限不足"从 `HTTPException(404, "Not Found")` 改成 `HTTPException(403, Envelope(code="FORBIDDEN", message=..., data=None, ...))`
2. 在 FastAPI 全局 `exception_handler` 注册 `HTTPException` 处理，统一返回信封（同时为 SHM-API-002 服务）
3. 资源级授权（用户对项目无访问权）同样改 403 而非 404

### 验证

```bash
pnpm vitest run tests/api/rbac.test.ts
```

预期：16 个用例全部从当前"任意 4xx"收紧为"`res.status === 403 && res.data.code === 'FORBIDDEN' && res.data.data === null`"，否则不算修复完成。

`tests/api/divergences.test.ts` 第 9 条同时作为"修复事实记录"指示器——当前用 `expect(true, '...')` 占位，修复后会因期望收紧触发红灯。

---

## SHM-API-002 · FastAPI 默认错误必须返回信封

**严重度**：🔴 高
**影响面**：所有路由兜底、运维日志脱敏、前端 `ElMessage.error` 文案

### 当前行为

当请求方法不允许、找不到对象、未被全局异常处理捕获时：

```bash
$ curl -X POST http://host/api/v1/data/ingest          # 未带 Authorization 时
HTTP/1.1 401 Unauthorized
{"detail":"Method Not Allowed"}                        ← 注意：是 401 但 body 走的是 405 的 detail

$ curl http://host/api/v1/not-a-real-endpoint
{"detail":"Not Found"}

$ curl -X DELETE http://host/api/v1/some-resource/that-is-not-yours
# 同一类 detail 情况
```

或后端非预期崩溃时 `{"detail":"Internal Server Error"}`。

### 期望行为

```json
HTTP 405  {"code":"METHOD_NOT_ALLOWED","message":"...","data":null,"timestamp":"..."}
HTTP 404  {"code":"NOT_FOUND","message":"...","data":null,"timestamp":"..."}
HTTP 500  {"code":"INTERNAL_ERROR","message":"...","data":null,"timestamp":"..."}
```

注意：OpenAPI 在 `responses[422]` 注明使用 `HTTPValidationError`。当 FastAPI 的 `RequestValidationError` 抛出来时，仍需要被 envelope 包起来，前端 `request.ts` 拦截器现已按 422 透传 FastAPI 默认结构。

### 建议修法

- 注册全局 `exception_handler(RequestValidationError, ...)`、`exception_handler(StarletteHTTPException, ...)`、`exception_handler(Exception, ...)`
- 全部出口走 `Envelope(code=..., message=..., data=None, timestamp=now)`
- 仍要保留对应 HTTP 状态码
- 推荐用同一个 `envelope_or_raise(code, status_code, message, data=None)` 帮手

### 验证

新增测试用例（前端会跟改）：
```ts
GET /api/v1/data/ingest （POST）→ 期望 { code:"NOT_ALLOWED" | "METHOD_NOT_ALLOWED", status:405, data:null }
GET /api/v1/non-existent    → 期望 { code:"NOT_FOUND", status:404, data:null }
```

`tests/api/divergences.test.ts` 会跟进补一条"非业务 4xx/5xx 必须走信封"。

---

## SHM-API-003 · `DELETE /projects/{id}` 残留 500

**严重度**：🔴 高
**影响面**：项目级清理、前端管理后台删除按钮误以为成功

### 复现脚本

```bash
ADMIN=$(curl -s -X POST http://host/api/v1/auth/login \
  -d 'username=admin&password=...' | jq -r .data.access_token)

PID=$(curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://host/api/v1/projects -d '{"name":"bug-repro"}' | jq -r .data.id)

# 只建一个设备，不建 sensor
curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  http://host/api/v1/devices \
  -d "{\"project_id\":$PID,\"device_code\":\"D1\",\"protocol\":\"mqtt\"}" >/dev/null

# 直接删项目 → 当前报 500
curl -i -X DELETE -H "Authorization: Bearer $ADMIN" http://host/api/v1/projects/$PID
# HTTP/1.1 500 Internal Server Error
# {"code":"INTERNAL_ERROR","message":"服务器内部错误","data":null,...}
```

### 期望

`HTTP 204 No Content`，按 OpenAPI 声明。

### 建议排查

- 在 `ProjectService.delete` / `crud.delete(project)` 中，删除项目前应级联处理 dev/sensor/channel——但删除顺序不当可能撞 FK 约束
- 如果实际策略是"先删下层再删项目"，需要兼容"项目只有设备无 sensor"的中间状态
- 推荐：把项目级删除写在一个事务里，先解除所有资源关联，再删项目

### 已修的部分（无需再处理）

| 前置状态 | DELETE /projects 状态 |
|---|---|
| 项目为空 | ✅ 204 |
| 项目 + 设备 + sensor | ✅ 204 |
| 项目 + 设备 + sensor + channel | ✅ 204 |
| 项目 + 设备（无 sensor） | ❌ 500 ← 本 issue |

### 验证

再次跑上方复现脚本，期望 204。`tests/api/projects.test.ts` 的"CRUD 完整周期"已覆盖"含设备 + 含 sensor + 含 channel"，但还没覆盖"项目+设备"中间状态；建议后端修完后，本前端会立刻补一个针对该 edge case 的用例。

---

## SHM-API-004 · `LoginResponse` 缺少 `role` 字段

**严重度**：🟡 中
**影响面**：登录链路、`stores/user.ts`、路由守卫的 role 判断

### 当前行为

```bash
$ curl -X POST http://host/api/v1/auth/login -d 'username=smoke&password=Smoke1234'
{
  "code": "OK",
  "message": "success",
  "data": {
    "admin_id": 33,
    "username": "smoke",
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  },
  "timestamp": "..."
}
```

> 注：以上是初始化管理员的 InitAdminResponse；登录本身返回 LoginResponse，应当包含同样的字段，并携带 `role` 与 `is_active`。

但解析 JWT 可以看到 payload：

```json
{ "sub":"33", "type":"access", "iat":..., "exp":..., "jti":"...", "role":"admin" }
```

`role` 已经在 token 里了，login 响应里没带，意味着前端需要自己解 JWT 才能拿到 role。

### 期望

```json
"data": {
  "user_id": 33,            // （admin 之外用 user_id；兼容方案：保留 admin_id 同时加 user_id）
  "username": "smoke",
  "email": "smoke@example.com",
  "role": "admin",          // ← 新增，与 token payload 对齐
  "is_active": true,        // ← 新增
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer"
}
```

### 建议修法

- 在 `LoginResponse` / `InitAdminResponse` 中补 `role`、`is_active`（也建议补 `email`）
- 后端业务码：删除 admin 后复用 `/auth/login` 登录的逻辑保持一致
- 更新 OpenAPI components.schemas

### 验证

前端会在 `tests/api/auth.test.ts` 新增：
```ts
it('LoginResponse 包含 role 与 is_active', async () => {
  const env = await login()
  const jwt = JSON.parse(Buffer.from(env.access.split('.')[1], 'base64url').toString())
  expect(jwt.role).toBe('admin')
  // 期望后端修复后：
  // const profile = await http.get('/users/me', { headers: { Authorization: ... }})
  // expect(profile.data.data.role).toBe(jwt.role)
})
```

---

## SHM-API-005 · `/sensors` 缺 `device_id` 错误码与其它 list 端点不一致

**严重度**：🟡 中
**影响面**：前端统一错误提示

### 当前行为

| 端点 | 缺必传 query | 状态码 | code |
|---|---|---|---|
| `/devices` 缺 `project_id` | 422 | `VALIDATION_ERROR` |
| `/sensors` 缺 `device_id` | **400** | **`BAD_REQUEST`** |
| `/channels` 缺 `sensor_id` | 422 | `VALIDATION_ERROR` |

### 期望

`/sensors` 行为应改为 422 + `VALIDATION_ERROR`，与另外两个端点对齐。

### 建议修法

在 `/sensors` 路由函数签名中将 `device_id: str = Query(...)` 改成同样的 `Query(..., min_length=1)` 风格（FastAPI/Pydantic 自动 422），与 `/devices` `/channels` 同源。

### 验证

```bash
pnpm vitest run tests/api/divergences.test.ts
```

期望"GET /sensors 缺 device_id"用例从"400 BAD_REQUEST"收紧为"422 VALIDATION_ERROR"。

---

## SHM-API-006 · `/api/v1/data/ingest` OpenAPI 与实际鉴权不一致

**严重度**：🟢 低
**影响面**：前端/集成方对 ingest 鉴权方式的认知

### 当前行为

```bash
# 用普通 user access_token 调 ingest → 后端返回 401 "API Key 无效"
$ curl -X POST -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
       -H 'Content-Type: application/json' \
       http://host/api/v1/data/ingest \
       -d '{"items":[{"channel_id":1,"value":1.0,"timestamp":"..."}]}'
HTTP/1.1 401 Unauthorized
{"code":"AUTH_ERROR","message":"API Key 无效","data":null,...}
```

但 OpenAPI 在 `paths./api/v1/data/ingest.post.security: []`（空数组），未声明任何 API Key scheme。

### 期望

OpenAPI 文档与实现一致：

- 方案 1：删除 ingest 的 `security: []`，添加 `security: [{ ApiKeyAuth: [] }]`，并在 `components.securitySchemes` 定义 `ApiKeyAuth: { type: apiKey, in: header, name: X-API-Key }`
- 方案 2：删除专属鉴权，让 ingest 也走 Bearer JWT（但前端没有相关逻辑，不建议）

### 建议修法

采用方案 1。在 README.md "数据接入"章节里写清：

> 设备侧数据通过 `POST /api/v1/data/ingest` 上行，鉴权使用设备级 `X-API-Key`（不是 user JWT）。前端不直接调用此接口；上行仅经 WSS 由采集服务完成。

### 验证

`tests/api/divergences.test.ts` 已记下"`POST /data/ingest` 即便带正确的 Bearer JWT 也返回 401 API Key 无效"为已知事实。文档修复不需通过自动化测试验收，由 PR review 即可。

---

## 2. 补充建议（非阻塞）

- 全部 admin-only 端点（`/users` CRUD、`POST /projects`、`PUT /platform` 等）的 OpenAPI `description` 字段加"需要 role=admin"。当前只有 `/platform` 写明。
- `/api/v1/setup/status` 的密码策略字段（`min_length`/`require_letter`/`require_digit`/`description`）在 OpenAPI 中补充定义，便于前端动态渲染。

## 3. 工作流建议

1. 后端按 SHM-API-001 → 004 → 003 → 002 → 005 → 006 顺序修，每修一个发 PR，前端 reviewer 用 `pnpm vitest run tests/api` 验证
2. 不要一次性大改，每条 PR 控制在 200~300 行
3. 修完后请把 OpenAPI `openapi.json` 同步更新（`/docs` 路径 + ci 里跑 `python scripts/dump_openapi.py` 之类的命令）
4. 全部修完后，前端的 `tests/api/divergences.test.ts` 应当全部通过；如有滞后请同步前端用例

## 4. 联系方式

- 前端接口测试目录：`tests/api/`（98 个用例）
- 测试运行命令：`pnpm vitest run tests/api`
- 任意一项修复后，相关的 divergences 测试会自动从通过切换到失败，或反过来。这是闭环信号。
