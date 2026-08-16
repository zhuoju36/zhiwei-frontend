<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as echarts from 'echarts/core'
import VChart from 'vue-echarts'
import type { ProjectOverviewItem } from '@/types/dashboard'

interface Props {
  projects: ProjectOverviewItem[]
}
const props = defineProps<Props>()

const emit = defineEmits<{
  select: [project: ProjectOverviewItem]
}>()

const geoLoaded = ref(false)
const loadError = ref<string | null>(null)

interface PointData {
  name: string
  value: [number, number, number, number, number, number]
  project: ProjectOverviewItem
}

const COLOR_NORMAL = '#67C23A'
const COLOR_WARNING = '#E6A23C'
const COLOR_DANGER = '#F56C6C'
const COLOR_NONE = '#909399'

/** 按在线率分档上色 */
function colorByRate(stats: ProjectOverviewItem['device_stats']): string {
  if (stats.total === 0) return COLOR_NONE
  const rate = stats.online / stats.total
  if (rate >= 0.9) return COLOR_NORMAL
  if (rate >= 0.6) return COLOR_WARNING
  return COLOR_DANGER
}

/** 设备数越多散点越大；下限 6，上限 28 */
function symbolSize(total: number): number {
  if (total <= 0) return 6
  return Math.min(8 + total * 0.8, 28)
}

onMounted(async () => {
  try {
    const res = await fetch('/maps/china.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const geoJson = await res.json()
    echarts.registerMap('china', geoJson)
    geoLoaded.value = true
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载地图数据失败'
  }
})

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: (params: { data?: PointData }): string => {
      const d = params.data
      if (!d) return ''
      const [, , total, online, offline, error] = d.value
      const { project } = d
      return [
        `<b>${project.name}</b>`,
        `设备: ${total}（在线 ${online} / 离线 ${offline} / 故障 ${error}）`,
        project.description ?? '',
      ]
        .filter(Boolean)
        .join('<br/>')
    },
  },
  geo: {
    map: 'china',
    roam: true,
    zoom: 1.2,
    label: { show: false },
    itemStyle: {
      areaColor: '#1e3a5f',
      borderColor: '#4a7ba8',
      borderWidth: 0.5,
    },
    emphasis: {
      label: { show: true, color: '#fff' },
      itemStyle: { areaColor: '#2d5a8c' },
    },
  },
  series: [
    {
      name: 'projects',
      type: 'scatter',
      coordinateSystem: 'geo',
      data: props.projects
        .filter((p) => p.location != null)
        .map<PointData>((p) => {
          const stats = p.device_stats
          const loc = p.location!
          return {
            name: p.name,
            value: [loc.lng, loc.lat, stats.total, stats.online, stats.offline, stats.error],
            project: p,
            itemStyle: { color: colorByRate(stats) },
          }
        }),
      symbolSize: (val: number[]) => symbolSize(val[2] ?? 0),
      emphasis: {
        focus: 'self',
        itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 8 },
      },
    },
  ],
}))

function onClick(params: unknown): void {
  const data = (params as { data?: { project?: ProjectOverviewItem } | null } | null)?.data
  if (!data?.project) return
  emit('select', data.project)
}
</script>

<template>
  <div class="map-chart">
    <el-empty v-if="loadError" :description="`地图数据加载失败：${loadError}`" />
    <v-chart
      v-else-if="geoLoaded"
      class="chart"
      :option="chartOption"
      autoresize
      @click="onClick"
    />
    <el-empty v-else description="加载地图中..." />
  </div>
</template>

<style scoped lang="scss">
.map-chart {
  width: 100%;
  height: 100%;
  min-height: 360px;
  position: relative;
  background: #0a1929;
  border-radius: 4px;
}
.chart {
  width: 100%;
  height: 100%;
}
</style>