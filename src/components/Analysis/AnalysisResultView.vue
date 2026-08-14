<script setup lang="ts">
/**
 * 分析结果视图分发：按插件声明的 result_view 路由到对应视图组件。
 * - fft    → FftResultView（频谱图 + FFT 摘要）
 * - generic / 未知 → 通用摘要渲染 + 附件下载按钮
 * 后端 v0.8d 起插件元信息带 result_view；缺失时按插件名兜底（fft → fft，其余 → generic）。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getResultBlob } from '@/api/analysis'
import SummaryRenderer from './SummaryRenderer.vue'
import FftResultView from './FftResultView.vue'
import type { AnalysisJob, AnalysisPluginMeta } from '@/types'
import type { Component } from 'vue'

const props = defineProps<{
  job: AnalysisJob
  plugin: AnalysisPluginMeta
}>()

/** 视图注册表：新增社区插件视图时在此登记 */
const viewRegistry: Record<string, Component> = {
  fft: FftResultView,
}

/** 解析展示视图名：优先插件声明，缺失时按插件名兜底 */
function resolveResultView(plugin: AnalysisPluginMeta): string {
  if (plugin.result_view) return plugin.result_view
  return plugin.name === 'fft' ? 'fft' : 'generic'
}

const viewName = computed(() => resolveResultView(props.plugin))
/** 已注册的专属视图组件；null 表示走 generic 兜底 */
const viewComponent = computed<Component | null>(
  () => viewRegistry[viewName.value] ?? null,
)

const downloading = ref(false)

/** 有附件（result_key 非空）时显示下载按钮 */
const hasArtifact = computed(() => Boolean(props.job.result_key))

/** 下载附件：文件名优先取后端 Content-Disposition，兜底 result_key 末段 */
async function downloadArtifact(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    const { blob, filename } = await getResultBlob(props.job.id)
    const fallback = props.job.result_key?.split('/').pop() ?? `result_${props.job.id}`
    const name = filename || fallback
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('附件下载失败')
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="result-view">
    <div class="view-header">
      <el-tag size="small" type="info">{{ viewName }} 视图</el-tag>
      <el-button
        v-if="hasArtifact"
        size="small"
        type="primary"
        plain
        :loading="downloading"
        @click="downloadArtifact"
      >
        下载附件
      </el-button>
    </div>

    <component :is="viewComponent" v-if="viewComponent" :job="job" />

    <div v-else class="generic-view">
      <SummaryRenderer :summary="job.result_summary" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.result-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.generic-view {
  background: #fff;
  border-radius: 4px;
  padding: 12px;
}
</style>
