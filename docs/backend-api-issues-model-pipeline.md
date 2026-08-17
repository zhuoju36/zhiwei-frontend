# 后端模型转换 Pipeline · Issue（运维 / 部署类）

> **来源**：前端 SHM 项目组
> **日期**：2026-08-17
> **环境**：8000 端口 + admin/admin / Admin1234
> **配套测试**：`tests/api/model-upload.test.ts`（功能层会从 warn-skip 自动转严格断言，无需改测试代码）

## 0. 一句话

模型上传后 `status` 永远停在 `pending`、下载永远 `409 MODEL_NOT_READY`。**根因：Celery worker 没启动，转换任务投递后没有消费者。**

---

## 1. 现象

- 上传 OBJ / STL / GLB / glTF / PLY 等模型 → 返回 `model_id` + `status="pending"`
- 5s / 10s / 20s / 30s 之后查 status 仍是 `pending`，`finished_at=null`
- `GET /api/v1/models/{id}/file` → `409 MODEL_NOT_READY`，body `{"code":"MODEL_NOT_READY","data":null,...}`
- 前端 `ModelManage.vue` 列表里模型永远是"转换中"状态
- 前端 `Scene3D.vue` 拉不到 GLB，大屏 3D 场景空白
- 前端 e2e 模型下载路径不可用

## 2. 根因（已诊断）

后端模型转换是 **Celery 异步任务**：

| 文件 | 关键内容 |
|---|---|
| `app/tasks/model_tasks.py:74` | `convert_model_task` 定义为 `@celery_app.task(bind=True, queue="reports")` |
| `app/tasks/celery_app.py` | broker = `redis://localhost:6379/1`；`task_routes["app.tasks.model_tasks.*"] = {"queue": "reports"}` |
| `app/routers/models.py:81` | 上传成功后调用 `convert_model_task.delay(model_id)` |
| `app/services/model_service.py:73-92` | `mark_running` / `mark_success` / `mark_failed` 状态机 |
| `scripts/model_convert.py` | `convert_bytes(data, source_format)` 实现 OBJ→GLB 等转换**

### 诊断证据

```bash
# 进程里没有任何 Celery worker
$ ps -ef | grep -iE "celery|worker"
（只有 IDE / 工具进程，没有 Celery worker）

# Redis 中的 reports 队列长度为 0，说明 .delay() 没真正投递
$ docker exec shm-redis redis-cli LLEN reports
0

# 后端日志里没有任何 conversion 相关日志
$ tail /tmp/shm-backend-uvicorn.log | grep -iE "convert|task|worker"
（空）
```

特别地，`routers/models.py:80-87` 的 try/except 把 `.delay()` 调用包了：

```python
try:
    convert_model_task.delay(model_id)
except Exception:
    async with AsyncSessionLocal() as session:
        await ModelService.mark_failed(session, model_id, "转换任务投递失败（队列不可用）")
        await session.commit()
```

按理 broker 不可达应该走 `mark_failed` 分支，但实际 `error` 字段仍是 `'-'`（empty），说明 `.delay()` 既没抛也没真投递——Kombu 在 fire-and-forget 模式下把消息吞进了本地缓冲而 broker 实际未连。

## 3. 复现

```bash
T=$(curl -s -X POST "http://host:8000/api/v1/auth/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin&password=Admin1234' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

PID=$(curl -s -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  "http://host:8000/api/v1/projects" -d '{"name":"repro-obj"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")

MID=$(curl -s -X POST -H "Authorization: Bearer $T" \
  -F "file=@tests/3dmodel/testObj.obj;type=model/obj" \
  "http://host:8000/api/v1/models/$PID/upload" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['model_id'])")

# 隔 5/10/20/30s 后查 status
for s in 5 10 20 30; do
  sleep $s
  echo "+${s}s:"
  curl -s -H "Authorization: Bearer $T" "http://host:8000/api/v1/models/$MID" \
    | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(f'  status={d[\"status\"]} err={d.get(\"error\") or \"-\"} glb_key={d.get(\"glb_key\") or \"-\"}')"
done
# 期望当前输出：每行都是 pending，error=-，glb_key=-
```

## 4. 修复

启动 Celery worker 监听 `reports` 队列：

```bash
cd /home/zhuoju36/dev/shm/shm-backend
source .venv/bin/activate

celery -A app.tasks.celery_app worker \
  --queues=reports \
  --loglevel=info \
  --concurrency=1 \
  --hostname=reports@%h
```

按后端 `AGENTS.md` §6 队列划分，`reports` 是 CPU 中等、I/O 为主（MinIO 读写）的任务，`--concurrency=1~2` 足够。

### 长期部署建议

- **docker-compose**：补一个 `celery-worker` 服务，沿用 backend 镜像，挂同一份 `.env` 与代码
- **systemd**：写 `shm-celery-reports.service`，`User=shm`、`WorkingDirectory=/opt/shm-backend`、`ExecStart=.../celery -A app.tasks.celery_app worker --queues=reports`、`Restart=always`
- **supervisor / k8s Deployment**：同理

### 健康检查

Celery worker 启动后会有 `celery@<hostname>.ready` 信号；可在 ops 监控里 ping 这个 signal。也可以写一个最小探针：用同一 redis broker 发一个 echo task，看队列深度变化。

## 5. 验证

修复后跑 §3 复现脚本，期望 `status` 在 **60s 内到 `success`**（OBJ→GLB 单文件通常 < 5s）：

```bash
sleep 30
curl -s -H "Authorization: Bearer $T" "http://host:8000/api/v1/models/$MID" | python3 -m json.tool
# 期望：
# {
#   "data": {
#     "id": ...,
#     "status": "success",
#     "glb_key": "models/<pid>/<uuid>.glb",
#     "finished_at": "2026-08-...",
#     "error": null,
#     ...
#   }
# }

# 下载 GLB 验证 magic
curl -s -o /tmp/x.glb -H "Authorization: Bearer $T" \
  "http://host:8000/api/v1/models/$MID/file"
head -c 4 /tmp/x.glb
# 期望：glTF
```

同时观察 redis：
```bash
docker exec shm-redis redis-cli LLEN reports  # 应为 0（任务已被消费）
docker exec shm-redis redis-cli KEYS 'celery*' | head  # 看 worker 注册信息
```

## 6. 前端契约已对齐，无需改前端代码

- 上传 envelope / 必传校验 / `409 MODEL_NOT_READY` / 列表分页 / 删除 —— `tests/api/model-upload.test.ts` 契约层（8 用例）严格跑通
- GLB 下载与 magic 校验 —— 功能层已写成**条件执行**：pipeline 不工作 → warn-skip；worker 起来 → 自动转严格断言
- `Scene3D.vue` 的 `loadModel` / `currentModel` 计算属性 / `dashboard` store 联动 —— 均已就绪，只等 `status='success'` 后模型能被 Scene3D 拉取

修复本 issue 后，前端大屏 3D 模型切换链路无需任何改动。

## 7. 关联文件 / 行号

- 后端 `app/tasks/model_tasks.py:74` — `@celery_app.task(bind=True, queue="reports")`
- 后端 `app/routers/models.py:80-87` — `.delay()` + try/except
- 后端 `app/services/model_service.py:75-92` — mark_running / mark_success / mark_failed
- 后端 `scripts/model_convert.py` — OBJ→GLB 转换实现
- 后端 `app/config.py` — `celery_broker_url: str = "redis://localhost:6379/1"`
- 前端 `tests/api/model-upload.test.ts` — 契约层 + 条件功能层
- 前端 `src/api/model.ts` — `uploadModel` / `getModelFileBlob` / `listModels`