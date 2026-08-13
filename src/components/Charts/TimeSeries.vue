<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { getTimeseries } from '@/api/data'
import { useWebSocketStore } from '@/stores/websocket'
import type { TimeInterval, TimeSeriesItem } from '@/types'

type SeriesPoint = [number, number]

interface Props {
  /** 参与绘图的测点 id 列表 */
  pointIds: number[]
  /** 初始历史回溯时长（分钟），跨度 ≤60 分钟用 raw 档，否则 1m 档 */
  minutes?: number
  /** 是否把 WebSocket 实时值追加到曲线（滑动窗口） */
  live?: boolean
  height?: string
}
const props = withDefaults(defineProps<Props>(), {
  minutes: 60,
  live: false,
  height: '260px',
})

const MAX_LIVE_POINTS = 500

const wsStore = useWebSocketStore()
const loading = ref(false)
const seriesMap = ref<Record<number, SeriesPoint[]>>({})

function itemToPoint(item: TimeSeriesItem): SeriesPoint | null {
  // 聚合档用 avg_val 作为曲线值，raw 档用 value
  const v = item.value ?? item.avg_val
  if (v == null) return null
  const ts = new Date(item.ts).getTime()
  if (Number.isNaN(ts)) return null
  return [ts, v]
}

async function fetchAll(): Promise<void> {
  const ids = [...props.pointIds]
  if (ids.length === 0) {
    seriesMap.value = {}
    return
  }
  loading.value = true
  try {
    const end = new Date()
    const start = new Date(end.getTime() - props.minutes * 60_000)
    const interval: TimeInterval = props.minutes <= 60 ? 'raw' : '1m'
    const results = await Promise.all(
      ids.map((id) =>
        getTimeseries({
          point_id: id,
          start: start.toISOString(),
          end: end.toISOString(),
          interval,
        }),
      ),
    )
    const map: Record<number, SeriesPoint[]> = {}
    results.forEach((res, i) => {
      map[ids[i]] = res.data.map(itemToPoint).filter((p): p is SeriesPoint => p !== null)
    })
    seriesMap.value = map
  } catch {
    // 错误提示由请求拦截器统一处理
    seriesMap.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => [props.pointIds, props.minutes], fetchAll, { immediate: true, deep: true })

// 实时追加：滑动窗口保留最近 MAX_LIVE_POINTS 点
watch(
  () => props.pointIds.map((id) => wsStore.latestData[id]),
  (payloads) => {
    if (!props.live) return
    let changed = false
    const map: Record<number, SeriesPoint[]> = { ...seriesMap.value }
    payloads.forEach((p, i) => {
      const id = props.pointIds[i]
      if (!p) return
      const ts = new Date(p.timestamp).getTime()
      if (Number.isNaN(ts)) return
      const arr = [...(map[id] ?? [])]
      // 丢弃乱序/重复时间戳
      if (arr.length > 0 && ts <= arr[arr.length - 1][0]) return
      arr.push([ts, p.value])
      if (arr.length > MAX_LIVE_POINTS) arr.splice(0, arr.length - MAX_LIVE_POINTS)
      map[id] = arr
      changed = true
    })
    if (changed) seriesMap.value = map
  },
  { deep: true },
)

const option = computed(() => ({
  animation: false,
  tooltip: { trigger: 'axis' },
  legend: props.pointIds.length > 1 ? { top: 0 } : undefined,
  grid: { left: 60, right: 20, top: props.pointIds.length > 1 ? 32 : 16, bottom: 24 },
  xAxis: { type: 'time' },
  yAxis: { type: 'value', scale: true },
  dataZoom: [{ type: 'inside' }],
  series: props.pointIds.map((id) => ({
    name: `测点 #${id}`,
    type: 'line',
    showSymbol: false,
    data: seriesMap.value[id] ?? [],
  })),
}))
</script>

<template>
  <div v-loading="loading" class="time-series" :style="{ height }">
    <v-chart v-if="pointIds.length" class="chart" :option="option" autoresize />
    <el-empty v-else description="请选择测点" :image-size="60" />
  </div>
</template>

<style scoped>
.time-series {
  width: 100%;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
