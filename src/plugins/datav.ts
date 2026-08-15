import type { App } from 'vue'
import {
  BorderBox1,
  BorderBox8,
  CapsuleChart,
  Decoration8,
  DigitalFlop,
  ScrollBoard,
  ScrollRankingBoard,
} from '@kjgl77/datav-vue3'

/**
 * DataV-Vue3 数据大屏组件按需注册。
 * 实际包名为 `@kjgl77/datav-vue3`（即原 DataV 的 Vue3 官方维护分支）；
 * 该包仅暴露主入口，未提供子路径导入，因此一次性注册本页所需组件即可。
 * 模板中使用 `dv-border-box-1` 等驼峰小写标签（已由 DataV 自动注册）。
 */
export function setupDataV(app: App): void {
  app.component('BorderBox1', BorderBox1)
  app.component('BorderBox8', BorderBox8)
  app.component('Decoration8', Decoration8)
  app.component('DigitalFlop', DigitalFlop)
  app.component('CapsuleChart', CapsuleChart)
  app.component('ScrollBoard', ScrollBoard)
  app.component('ScrollRankingBoard', ScrollRankingBoard)
}