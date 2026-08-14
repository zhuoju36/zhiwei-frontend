<script setup lang="ts">
/**
 * 分析任务页：通用插件列表 + 动态参数表单 + 任务提交与轮询。
 * 结果展示统一由 AnalysisResultView 按插件 result_view 分发。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createJob, getJob, listPlugins } from '@/api/analysis'
import { useDashboardStore } from '@/stores/dashboard'
import AnalysisResultView from '@/components/Analysis/AnalysisResultView.vue'
import type { AnalysisJob, AnalysisPluginMeta } from '@/types'

const dashboardStore = useDashboardStore()

const channelId = ref<number | string>('')
const plugins = ref<AnalysisPluginMeta[]>([])
const pluginName = ref('')
/** 当前插件参数表单值（对应 params_schema.properties） */
const paramsModel = ref<Record<string, unknown>>({})
const analyzing = ref(false)
const job = ref<AnalysisJob | null>(null)

let pollTimer: ReturnType<typeof setTimeout> | null = null

/** 当前选中插件元信息 */
const currentPlugin = computed<AnalysisPluginMeta | null>(
  () => plugins.value.find((p) => p.name === pluginName.value) ?? null,
)

/** 当前插件的 params_schema.properties（JSON Schema 属性定义） */
const paramsProps = computed<Record<string, Record<string, unknown>>>(() => {
  const schema = currentPlugin.value?.params_schema
  const props = (schema as { properties?: Record<string, Record<string, unknown>> } | undefined)
    ?.properties
  return props ?? {}
})

/** 依据 properties 类型生成输入控件 */
function propInputType(prop: Record<string, unknown>): 'number' | 'string' | 'boolean' {
  const t = String(prop.type ?? 'string')
  if (t === 'number' || t === 'integer') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'string'
}

function propDescription(prop: Record<string, unknown>): string {
  return typeof prop.description === 'string' ? prop.description : ''
}

onMounted(async () => {
  if (dashboardStore.projects.length === 0) {
    await dashboardStore.fetchProjects()
  }
  try {
    plugins.value = await listPlugins()
    if (plugins.value.length > 0) {
      pluginName.value = plugins.value[0].name
    }
  } catch {
    // 插件列表拉取失败时静默（提交时后端仍会校验）
  }
})

// 切换插件时重置参数表单与已提交任务
watch(pluginName, () => {
  paramsModel.value = {}
  job.value = null
})

onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

/** 提交分析任务（插件与参数取自表单）并轮询至完成 */
async function runAnalysis(): Promise<void> {
  const cid = Number(channelId.value)
  if (!Number.isInteger(cid) || cid <= 0) {
    ElMessage.warning('请选择通道')
    return
  }
  if (!pluginName.value) {
    ElMessage.warning('请选择分析插件')
    return
  }
  if (pollTimer) clearTimeout(pollTimer)
  job.value = null
  analyzing.value = true
  try {
    // 过滤空值参数（空字符串/未填数字不提交，交给后端默认值）
    const params: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(paramsModel.value)) {
      if (v !== '' && v !== undefined && v !== null) params[k] = v
    }
    const res = await createJob({ channel_id: cid, plugin: pluginName.value, params })
    await pollJob(res.job_id)
  } catch {
    // 错误提示由请求拦截器统一处理
    analyzing.value = false
  }
}

async function pollJob(jobId: number): Promise<void> {
  try {
    const j = await getJob(jobId)
    job.value = j
    if (j.status === 'success' || j.status === 'failed') {
      analyzing.value = false
      if (j.status === 'failed') {
        ElMessage.error(j.error || '分析任务失败')
      }
      return
    }
    // pending / running：1s 后继续轮询
    pollTimer = setTimeout(() => void pollJob(jobId), 1000)
  } catch {
    analyzing.value = false
  }
}
</script>

<template>
  <div class="analysis-task-page">
    <el-form inline class="query-form">
      <el-form-item label="通道">
        <el-select
          v-model="channelId"
          filterable
          allow-create
          default-first-option
          placeholder="选择通道，或输入通道 ID"
          class="channel-select"
        >
          <el-option
            v-for="c in dashboardStore.channels"
            :key="c.id"
            :label="`${c.channel_code}（#${c.id}）`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="分析插件">
        <el-select v-model="pluginName" class="plugin-select">
          <el-option
            v-for="p in plugins"
            :key="p.name"
            :label="p.display_name || p.name"
            :value="p.name"
          >
            <span>{{ p.display_name || p.name }}</span>
            <span class="plugin-version">v{{ p.version }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item
        v-for="(prop, key) in paramsProps"
        :key="key"
        :label="String(key)"
      >
        <el-input-number
          v-if="propInputType(prop) === 'number'"
          v-model="paramsModel[key] as number | undefined"
          :placeholder="propDescription(prop)"
          :title="propDescription(prop)"
        />
        <el-switch
          v-else-if="propInputType(prop) === 'boolean'"
          v-model="paramsModel[key] as boolean"
        />
        <el-input
          v-else
          v-model="paramsModel[key] as string"
          :placeholder="propDescription(prop) || String(key)"
          :title="propDescription(prop)"
          style="width: 160px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="analyzing" @click="runAnalysis">开始分析</el-button>
      </el-form-item>
    </el-form>

    <div v-if="analyzing" v-loading="true" class="analyzing-tip">
      {{ job ? `任务 #${job.id} 状态：${job.status}…` : '提交分析任务…' }}
    </div>

    <div v-if="job && job.status === 'success'" class="result-card">
      <AnalysisResultView v-if="currentPlugin" :job="job" :plugin="currentPlugin" />
    </div>

    <el-empty
      v-if="!analyzing && !(job && job.status === 'success')"
      description="选择通道与插件后点击「开始分析」"
    />
  </div>
</template>

<style scoped lang="scss">
.analysis-task-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-form {
  padding: 12px 12px 0;
  background: #fff;
  border-radius: 4px;
}

.channel-select {
  width: 220px;
}

.plugin-select {
  width: 180px;

  .plugin-version {
    float: right;
    margin-left: 12px;
    color: #909399;
    font-size: 12px;
  }
}

.analyzing-tip {
  padding: 16px;
  min-height: 80px;
}

.result-card {
  background: #fff;
  border-radius: 4px;
  padding: 12px;
}
</style>
