<script setup lang="ts">
/**
 * FFT 频谱视图：解析任务 NPZ 附件（frequencies/magnitudes）绘制频谱图，
 * 并展示 FFT 形态的 result_summary；NPZ 解析失败时回退摘要。
 */
import { computed, onMounted, ref } from 'vue'
import JSZip from 'jszip'
import VChart from 'vue-echarts'
import { getResultBlob } from '@/api/analysis'
import { parseNpy } from '@/utils/npy'
import { formatNumber } from '@/utils/format'
import { isFftSummary } from '@/types'
import SummaryRenderer from './SummaryRenderer.vue'
import type { AnalysisJob, SpectrumData } from '@/types'

const props = defineProps<{
  job: AnalysisJob
}>()

const spectrum = ref<SpectrumData | null>(null)
const loading = ref(true)
const parseFailed = ref(false)

onMounted(() => {
  void loadSpectrum()
})

/** 取 NPZ 附件并解析；失败回退到 result_summary */
async function loadSpectrum(): Promise<void> {
  try {
    const { blob } = await getResultBlob(props.job.id)
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
      samplingRate: sr ? Number(sr.data[0]) : 0,
    }
    parseFailed.value = false
  } catch {
    parseFailed.value = true
    spectrum.value = null
  } finally {
    loading.value = false
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

/** FFT 形态的摘要（类型守卫后读取字段） */
const fftSummary = computed(() =>
  isFftSummary(props.job.result_summary) ? props.job.result_summary : null,
)
</script>

<template>
  <div class="fft-result">
    <div v-if="loading" v-loading="true" class="loading-tip">解析附件…</div>

    <div v-if="spectrum" class="chart-card">
      <div class="chart-title">
        FFT 频谱
        <span v-if="spectrum.samplingRate > 0" class="chart-sub">
          采样率 {{ spectrum.samplingRate }}Hz · {{ spectrum.frequencies.length }} 个频点
        </span>
      </div>
      <v-chart class="chart" :option="option" autoresize />
    </div>

    <el-card v-if="fftSummary" shadow="never" class="summary-card">
      <template #header>
        <div class="summary-head">
          <span>分析结果摘要</span>
          <el-tag v-if="parseFailed" type="warning" size="small">NPZ 解析失败，以下为后端摘要</el-tag>
        </div>
      </template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="主频 (Hz)">{{ formatNumber(fftSummary.dominant_freq) }}</el-descriptions-item>
        <el-descriptions-item label="主频幅值">{{ formatNumber(fftSummary.dominant_magnitude) }}</el-descriptions-item>
        <el-descriptions-item label="采样点数">{{ fftSummary.num_samples }}</el-descriptions-item>
        <el-descriptions-item label="采样率 (Hz)">{{ formatNumber(fftSummary.sampling_rate) }}</el-descriptions-item>
        <el-descriptions-item label="Nyquist (Hz)">{{ formatNumber(fftSummary.nyquist_freq) }}</el-descriptions-item>
        <el-descriptions-item label="频率分辨率 (Hz)">{{ formatNumber(fftSummary.freq_resolution) }}</el-descriptions-item>
      </el-descriptions>
      <h4 class="peaks-title">主要峰值</h4>
      <el-table :data="fftSummary.top_peaks" border size="small">
        <el-table-column label="频率 (Hz)" min-width="120">
          <template #default="{ row }">{{ formatNumber(row.freq) }}</template>
        </el-table-column>
        <el-table-column label="幅值" min-width="120">
          <template #default="{ row }">{{ formatNumber(row.magnitude) }}</template>
        </el-table-column>
      </el-table>
      <div v-if="fftSummary.warnings?.length" class="warnings">
        <div v-for="(w, i) in fftSummary.warnings" :key="i" class="warning-line">⚠ {{ w }}</div>
      </div>
    </el-card>

    <!-- 摘要不是 FFT 形态时（如解析失败且摘要缺失）走通用渲染器 -->
    <el-card v-else-if="job.result_summary && !loading" shadow="never" class="summary-card">
      <template #header>
        <div class="summary-head">
          <span>分析结果摘要</span>
          <el-tag v-if="parseFailed" type="warning" size="small">NPZ 解析失败，以下为后端摘要</el-tag>
        </div>
      </template>
      <SummaryRenderer :summary="job.result_summary" />
    </el-card>

    <el-empty
      v-if="!loading && !spectrum && !job.result_summary"
      description="暂无频谱与摘要"
    />
  </div>
</template>

<style scoped lang="scss">
.fft-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-tip {
  padding: 24px;
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
