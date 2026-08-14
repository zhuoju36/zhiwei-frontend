# 任务提示词：分析插件结果通用展示（前端）

> 来源：shm-backend v0.8d「分析插件 API v2」配套的前端改造
> 给前端开发者的实施任务单。开始前先读 `AGENTS.md`（编码规范）与本仓库 `src/views/Analysis/Spectrum.vue`。

## 一、背景

后端 v0.8d 已升级分析插件体系（`AnalysisPlugin` v2）：插件 = 纯计算单元（输入数组 + 参数 → JSON 摘要 + 可选二进制附件），社区开发者可通过 Python entry_points 自动接入，**插件作者不需要写前端**。

前端现状：`src/views/Analysis/Spectrum.vue` 已实现**通用插件列表 + 动态参数表单 + 任务提交与轮询**，但**结果展示是 FFT 专用硬编码**——`ResultSummary` 类型写死 `dominant_freq/top_peaks/nyquist_freq` 等字段，结果区写死解析 NPZ 的 `frequencies.npy/magnitudes.npy` 并渲染频谱图。社区插件的任意 JSON 摘要（如 `statistics` 插件的 `mean/rms`）与通用附件**当前无法展示**。

## 二、目标

将分析结果展示通用化，让**任意**分析插件的结果开箱即用：

1. `result_view` 视图分发（插件声明展示类型 → 前端路由到对应组件）
2. 通用摘要渲染器：任意 JSON `result_summary` 按值类型渲染
3. 通用附件下载按钮：任意插件声明的 `artifact`
4. FFT 频谱图作为 `result_view="fft"` 的注册视图，行为与现状一致（回归）

## 三、后端契约（已就绪；`result_view` 字段随本次配套上线）

### 3.1 `GET /api/v1/analysis/plugins`（无鉴权，公开元信息）

响应元素（`AnalysisPluginMeta`，**新增 `result_view` 字段**）：

```json
{
  "name": "fft",
  "display_name": "FFT 频谱分析",
  "description": "快速傅里叶变换，输出主频、幅值谱与峰值列表（附件含完整频谱）",
  "version": "2.0.0",
  "input_channels": 1,
  "min_samples": 2,
  "params_schema": { "type": "object", "properties": { "sampling_rate": { "type": "number" } } },
  "result_view": "fft"
}
```

- `result_view` 取值约定：`generic`（默认，无专属图表）、`fft`（频谱图）、未来其它视图名（社区贡献）
- 内置插件：`fft` → `result_view="fft"`；`statistics` → `result_view="generic"`

### 3.2 `GET /api/v1/analysis/jobs/{id}`（需登录）

`AnalysisJob`：`result_summary` 为**任意 JSON**（不保证含 FFT 字段）；`result_key` 非空表示有附件。

### 3.3 `GET /api/v1/analysis/jobs/{id}/result`（需登录，下载附件）

- 200：二进制附件。`Content-Type` 为插件声明的 `artifact_type`；`Content-Disposition: attachment; filename="<artifact_name>"`（如 `fft_1.npz`）
- 409 `ANALYSIS_RESULT_NOT_READY`：任务未完成
- 前端已封装 `getResultBlob(jobId)`（`src/api/analysis.ts`，独立 axios blob 下载，自动带 JWT）

## 四、现状文件（只读参考，按需改动）

| 文件 | 现状 | 动作 |
|------|------|------|
| `src/views/Analysis/Spectrum.vue` | 表单/提交/轮询通用；结果区（`loadResult` NPZ 硬编码解析、频谱 `option`、FFT 摘要卡片）需重构 | **重构**：结果区替换为分发组件 |
| `src/types/analysis.ts` | `ResultSummary` 为 FFT 专用类型 | **改造**：泛化 |
| `src/api/analysis.ts` | `listPlugins/createJob/getJob/getResultBlob` 已就绪 | 基本不动（`listPlugins` 返回类型随类型定义更新） |
| `src/components/Charts/SpectrumChart.vue` | 频谱图封装（ECharts） | 可复用 |
| `src/utils/npy.ts` | NPY 读取器（float64/float32 一维） | 保留，供 fft 视图使用 |
| `src/utils/format.ts` | `formatNumber` 等格式化 | 复用 |
| `src/views/Admin/PluginManage.vue` | 插件说明页（可顺带展示 `result_view`） | 可选 |

## 五、任务清单

### 1. 类型定义 `src/types/analysis.ts`

- `AnalysisPluginMeta` 增加 `result_view: string`
- `ResultSummary` 泛化：改为 `Record<string, unknown>`，另建可选接口（如 `FftSummary extends Record<string, unknown>`）承载 FFT 字段（`dominant_freq/top_peaks/...`），供 fft 视图用
- `AnalysisJob.result_summary` 类型随之更新

### 2. 通用摘要渲染组件（新建 `src/components/Analysis/SummaryRenderer.vue`）

- Props：`summary: Record<string, unknown>`（可空）
- 按值类型渲染（Element Plus）：
  - `number` → `formatNumber()` 格式化展示
  - `string` / `boolean` → 直接显示（`el-tag` 可给 boolean 着色）
  - `number[]` / `object[]`（数组）→ `el-table` 或列表（对象数组取首元素 key 做列头）
  - 嵌套对象 → 递归/折叠渲染（`el-collapse` 或缩进）
- 空摘要 → `el-empty` 占位
- 展示顺序：保留 JSON 键序，不依赖字段名（不要写死 FFT 字段）

### 3. 结果视图分发组件（新建 `src/components/Analysis/AnalysisResultView.vue`）

- Props：`job: AnalysisJob`、`plugin: AnalysisPluginMeta`
- 内部维护视图注册表：`Record<result_view, Component>`：
  - `generic` → `SummaryRenderer` + 附件下载按钮
  - `fft` → FFT 频谱视图组件（从 `Spectrum.vue` 迁移：NPZ 解析 + `SpectrumChart` + FFT 摘要）
  - 未知 `result_view` → 降级 `generic`
- 附件下载按钮（`result_key` 非空时显示）：调 `getResultBlob(job.id)`，`URL.createObjectURL` + `<a download>` 触发下载；文件名优先解析 `Content-Disposition` 的 `filename`，兜底取 `result_key` 末段
- 加载/失败状态沿用现有交互（`el-button :loading`、`el-message`）

### 4. 重构 `src/views/Analysis/Spectrum.vue`

- 保留：通道选择、插件下拉（展示 `display_name` + `version`）、`params_schema` 动态表单、提交 + 轮询
- 删除：`loadResult` 的 NPZ 硬编码解析、频谱 `option`、FFT 摘要卡片模板
- 结果区替换为 `<AnalysisResultView :job="job" :plugin="当前插件" />`
- 频谱图相关逻辑迁入 fft 视图组件（`src/components/Analysis/FftResultView.vue` 或并入 `AnalysisResultView`）

### 5. 入口（可选但推荐）

- 若 `Analysis/Index.vue` 有 tab 结构，考虑将 `Spectrum.vue` 重命名/复制为「通用分析」入口（`AnalysisTask.vue`），语义上承载所有插件；或保留现名并调整标题为「分析任务」
- `src/views/Admin/PluginManage.vue` 插件表顺带展示 `result_view` 列（可选）

## 六、技术要点

- 严格遵循 `AGENTS.md`：`<script setup lang="ts">`、`defineProps<T>()`、PascalCase 多单词组件名、`@/` 别名、禁止 `any` 滥用（JSON 值可用 `unknown` + 类型守卫）
- 可复用组件放 `src/components/Analysis/`，页面组件保持薄
- ECharts 按需引入已在 `src/plugins/echarts.ts` 注册，图表组件沿用 `v-chart`
- NPZ 解析（`jszip` + `parseNpy`）只在 fft 视图内保留；`generic` 视图不要依赖它
- 不要引入新的状态管理（Pinia）——本次改造是组件内局部状态，沿用 `ref`
- 不要动后端接口；若发现契约不一致（字段名/类型），先核对 `shm-backend/docs/api/analysis.md` 再处理

## 七、验收标准

1. **statistics 插件**（`result_view=generic`）：提交任务成功后显示 `mean/min/max/std/rms/num_samples` 摘要；无附件时不出现下载按钮
2. **fft 插件**：频谱图、摘要卡片与改造前行为一致（回归）
3. **任意 JSON 摘要**：渲染不报错，number 走格式化，数组/嵌套对象有合理展示
4. **附件下载**：fft 任务有下载按钮，点击下载文件名形如 `fft_1.npz`（来自后端 `Content-Disposition`）
5. **未知 result_view** 降级 generic 不白屏
6. `pnpm build`（或 `npm run build`）类型检查通过，`pnpm lint` 无新增错误

## 八、参考文档

- 后端插件开发指南：`../shm-backend/docs/development/plugin-dev.md`
- 后端分析 API：`../shm-backend/docs/api/analysis.md`
- 前端分析 API 封装：`src/api/analysis.ts`
- 前端类型定义：`src/types/analysis.ts`
