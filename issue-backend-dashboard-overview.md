# 后端支持：项目地图一次性聚合接口（`GET /dashboard/overview`）

> 前端 shm-frontend v0.2.5 新增「项目地图」功能（路径：`/analysis/project-map`），需要后端提供一个聚合接口，避免前端循环查询设备列表。

## 背景

数据分析页面新增「项目地图」入口：

- 在 ECharts 中国地图上展示所有项目的地理位置（散点）
- 点大小 ∝ 设备总数；点颜色按在线率分档（绿/黄/红/灰）
- 点击项目点 → 浮窗显示该项目下设备的在线/离线/故障/总数汇总

当前 `Device` 表已挂在 `project_id` 下、`status` 枚举为 `online/offline/error`，前端**完全可以**循环调 `GET /devices?project_id=` 自己聚合，但代价是：

- 请求扇出过大（项目数 × 每个项目的设备查询），项目 > 50 时不可接受
- 前端聚合逻辑分散、缺文档化、不好维护
- 项目 > 1000 后前端聚合的内存与渲染压力陡增

需要后端提供一个**一次拉完**的聚合接口。

## 接口契约

```
GET /api/v1/dashboard/overview
Auth: 需要登录（普通用户仅返回被授权的项目，行为与 GET /projects 一致）

200 Response:
{
  "projects": [
    {
      "id": 1,
      "name": "钱塘江大桥监测",
      "description": "主桥结构健康监测",
      "location": {
        "lat": 30.198,
        "lng": 120.215,
        "address": "浙江省杭州市钱塘江大桥"
      },
      "device_stats": {
        "total": 12,
        "online": 10,
        "offline": 1,
        "error": 1
      }
    },
    {
      "id": 2,
      "name": "未配置位置的项目",
      "description": null,
      "location": null,
      "device_stats": { "total": 5, "online": 5, "offline": 0, "error": 0 }
    }
  ]
}
```

## 字段定义

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 项目 ID |
| `name` | string | 项目名称 |
| `description` | string \| null | 项目描述 |
| `location` | object \| null | 项目地理位置，**可空**——无位置的项目**也必须**出现在列表中，由前端旁路用表格展示 |
| `location.lat` | float | 纬度 |
| `location.lng` | float | 经度 |
| `location.address` | string \| null | 文字地址 |
| `device_stats` | object | 设备状态聚合 |
| `device_stats.total` | int | 设备总数 |
| `device_stats.online` | int | 在线（`status='online'`） |
| `device_stats.offline` | int | 离线（`status='offline'`） |
| `device_stats.error` | int | 故障（`status='error'`） |

## 约束

- **`total == online + offline + error` 必须自洽**（前端会据此校验）
- **不**做分页：项目量级在数十~数百，一次返回即可
- **不**接受过滤参数：前端只展示全量（鉴权过滤由后端按现有规则处理）
- 项目权限模型与 `GET /projects` 完全一致：普通用户仅返回被授权项目；admin 全量

## 验收

- [ ] 按契约返回 200，结构与上述完全一致
- [ ] 每个 `project.device_stats` 满足 `total == online + offline + error`
- [ ] `location=null` 的项目也出现在列表中（不被过滤）
- [ ] 普通用户只能看到自己有 read 权限的项目（与 `GET /projects` 行为一致）
- [ ] Swagger / OpenAPI / 内部 API 文档新增该接口

## 实现提示

- SQL 思路：`projects` LEFT JOIN `devices`，GROUP BY `project_id` 聚合 `status`
- 项目权限过滤可复用现有 `GET /projects` 的过滤逻辑
- 不需要新增权限/角色，鉴权走现有 JWT 中间件

## 前端对接参考

- 类型位置（前端）: `src/types/dashboard.ts`（`ProjectOverviewItem` / `DashboardOverview`）
- API 封装位置（前端）: `src/api/dashboard.ts`（`getOverview()`）
- 临时回退：接口未就绪前，前端会用 mock 数据兜底，接口上线后切换即可