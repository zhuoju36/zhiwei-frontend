<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import JSZip from 'jszip'
import VChart from 'vue-echarts'
import { createJob, getJob, getResultBlob, listPlugins } from '@/api/analysis'
import { parseNpy } from '@/utils/npy'
import { formatNumber } from '@/utils/format'
import { useDashboardStore } from '@/stores/dashboard'
import type { AnalysisJob, AnalysisPluginMeta, ResultSummary, SpectrumData } from '@/types'

const dashboardStore = useDashboardStore()

const channelId = ref<number | string>('')
const plugins = ref<AnalysisPluginMeta[]>([])
const pluginName = ref('')
/** 当前插件参数表单值（对应 params_schema.properties） */
const paramsModel = ref<Record<string, unknown>>({})
const analyzing = ref(false)
const job = ref<AnalysisJob | null>(null)
const spectrum = ref<SpectrumData | null>(null)
const summary = ref<ResultSummary | null>(null)
/** NPZ 解析失败时回退展示 result_summary */
const parseFailed = ref(false)

let pollTimer: ReturnType<typeof setTimeout> | null = null

/** 当前插件的 params_schema.properties（JSON Schema 属性定义） */
const paramsProps = computed<Record<string, Record<string, unknown>>>(() => {
  const schema = plugins.value.find((p) => p.name === pluginName.value)?.params_schema
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
  if (dashboardStore.subitems.length === 0) {
    await dashboardStore.fetchSubitems()
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

// 切换插件时重置参数表单
watch(pluginName, () => {
  paramsModel.value = {}
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
  spectrum.value = null
  summary.value = null
  parseFailed.value = false
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
    if (j.status === 'success') {
      analyzing.value = false
      await loadResult(jobId)
      return
    }
    if (j.status === 'failed') {
      analyzing.value = false
      ElMessage.error(j.error || '分析任务失败')
      return
    }
    // pending / running：1s 后继续轮询
    pollTimer = setTimeout(() => void pollJob(jobId), 1000)
  } catch {
    analyzing.value = false
  }
}

/** 取 NPZ 结果并用 JSZip + 内置 NPY 读取器解析；失败回退 result_summary */
async function loadResult(jobId: number): Promise<void> {
  try {
    const blob = await getResultBlob(jobId)
    const zip = await JSZip.loadAsync(blob)
    const freqFile = zip.file('frequencies.npy')
    const magFile = zip.file('magnitudes.npy')
    const srFile = zip.file('sampling_rate.npy')
    if (!freqFile || !magFile) throw new Error('NPZ 缺少 frequencies/magnitudes')

    const [freqs, mags, sr] = await Promise.all([
      freqFile.async('arraybuffer').then(parseNpy),
      magFile.async('arraybuffer').then(parseNpy),
      srFile ? srFile.async('arraybuffer').then(parseNpy) : null,
    ])
    spectrum.value = {
      frequencies: freqs.data,
      magnitudes: mags.data,
      samplingRate: sr ? Number(sr.data[0]) : (job.value?.result_summary?.sampling_rate ?? 0),
    }
    summary.value = job.value?.result_summary ?? null
    parseFailed.value = false
  } catch {
    parseFailed.value = true
    spectrum.value = null
    summary.value = job.value?.result_summary ?? null
  }
}

const option = computed(() => {
  const sp = spectrum.value
  if (!sp) return {}
  const data = Array.from({ length: sp.frequencies.length }, (_, i) => [
    sp.frequencies[i],
    sp.magnitudes[i],
  ])
  return {
    animation: false,
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 40, bottom: 24 },
    xAxis: { type: 'value', name: '频率 (Hz)' },
    yAxis: { type: 'value', name: '幅值', scale: true },
    series: [
      {
        name: 'FFT 频谱',
        type: 'line',
        showSymbol: false,
        data,
      },
    ],
  }
})
</script>

<template>
  <div class="spectrum-page">
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

    <div v-if="spectrum" class="chart-card">
      <div class="chart-title">
        {{ plugins.find((p) => p.name === pluginName)?.display_name || '频谱分析' }}
        <span v-if="spectrum.samplingRate > 0" class="chart-sub">
          采样率 {{ spectrum.samplingRate }}Hz · {{ spectrum.frequencies.length }} 个频点
        </span>
      </div>
      <v-chart class="chart" :option="option" autoresize />
    </div>

    <el-card v-if="summary" shadow="never" class="summary-card">
      <template #header>
        <div class="summary-head">
          <span>分析结果摘要</span>
          <el-tag v-if="parseFailed" type="warning" size="small">NPZ 解析失败，以下为后端摘要</el-tag>
        </div>
      </template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="主频 (Hz)">{{ formatNumber(summary.dominant_freq) }}</el-descriptions-item>
        <el-descriptions-item label="主频幅值">{{ formatNumber(summary.dominant_magnitude) }}</el-descriptions-item>
        <el-descriptions-item label="采样点数">{{ summary.num_samples }}</el-descriptions-item>
        <el-descriptions-item label="采样率 (Hz)">{{ formatNumber(summary.sampling_rate) }}</el-descriptions-item>
        <el-descriptions-item label="Nyquist (Hz)">{{ formatNumber(summary.nyquist_freq) }}</el-descriptions-item>
        <el-descriptions-item label="频率分辨率 (Hz)">{{ formatNumber(summary.freq_resolution) }}</el-descriptions-item>
      </el-descriptions>
      <h4 class="peaks-title">主要峰值</h4>
      <el-table :data="summary.top_peaks" border size="small">
        <el-table-column label="频率 (Hz)" min-width="120">
          <template #default="{ row }">{{ formatNumber(row.freq) }}</template>
        </el-table-column>
        <el-table-column label="幅值" min-width="120">
          <template #default="{ row }">{{ formatNumber(row.magnitude) }}</template>
        </el-table-column>
      </el-table>
      <div v-if="summary.warnings?.length" class="warnings">
        <div v-for="(w, i) in summary.warnings" :key="i" class="warning-line">⚠ {{ w }}</div>
      </div>
    </el-card>

    <el-empty v-if="!analyzing && !spectrum && !summary" description="选择通道与插件后点击「开始分析」" />
  </div>
</template>

<style scoped lang="scss">
.spectrum-page {
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

.chart-card {
  background: #fff;
  border-radius: 4px;
  padding: 12px;
}

.chart-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.chart-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.chart {
  height: 420px;
}

.summary-card {
  .summary-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .peaks-title {
    margin: 16px 0 8px;
  }

  .warnings {
    margin-top: 8px;
    font-size: 12px;
    color: #e6a23c;
  }
}
</style>
