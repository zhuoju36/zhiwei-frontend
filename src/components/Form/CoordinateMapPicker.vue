<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import type { ECharts } from 'echarts/core'
import VChart from 'vue-echarts'

/** 简单的经纬度对 */
export interface LatLng {
  lat: number
  lng: number
}

interface Props {
  modelValue: LatLng | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: LatLng | null]
}>()

const geoLoaded = ref(false)
const loadError = ref<string | null>(null)
const latInput = ref('')
const lngInput = ref('')
const chartRef = ref<InstanceType<typeof VChart> | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/maps/china.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const geoJson = await res.json()
    echarts.registerMap('china', geoJson)
    geoLoaded.value = true
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载地图失败'
  }
})

watch(
  () => props.modelValue,
  (v) => {
    latInput.value = v ? String(v.lat) : ''
    lngInput.value = v ? String(v.lng) : ''
  },
  { immediate: true },
)

function roundCoord(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

const chartOption = computed(() => ({
  tooltip: { show: false },
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
      name: 'selected',
      type: 'scatter',
      coordinateSystem: 'geo',
      symbol: 'pin',
      symbolSize: 28,
      itemStyle: { color: '#F56C6C' },
      data: props.modelValue
        ? [{ name: '选中', value: [props.modelValue.lng, props.modelValue.lat] }]
        : [],
    },
  ],
}))

function onMapClick(params: unknown): void {
  const chart = (chartRef.value as unknown as { chart?: ECharts } | null)?.chart
  if (!chart) return
  const native = (params as { event?: { event?: unknown } } | null)?.event?.event
  if (!native || typeof native !== 'object' || !('offsetX' in native) || !('offsetY' in native)) {
    return
  }
  const { offsetX, offsetY } = native as MouseEvent
  const geoCoord = chart.convertFromPixel({ geoIndex: 0 }, [offsetX, offsetY])
  if (!Array.isArray(geoCoord)) return
  const [lng, lat] = geoCoord as [number, number]
  emit('update:modelValue', { lat: roundCoord(lat), lng: roundCoord(lng) })
}

function clearPoint(): void {
  emit('update:modelValue', null)
}

function syncFromInput(): void {
  const lat = Number(latInput.value)
  const lng = Number(lngInput.value)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    emit('update:modelValue', { lat, lng })
  }
}
</script>

<template>
  <div class="coord-picker">
    <el-empty
      v-if="loadError"
      :description="`地图加载失败：${loadError}`"
      :image-size="80"
    />
    <v-chart
      v-else-if="geoLoaded"
      ref="chartRef"
      class="map"
      :option="chartOption"
      autoresize
      @click="onMapClick"
    />
    <el-empty v-else description="加载地图中..." :image-size="60" />

    <div class="input-row">
      <el-input
        v-model="lngInput"
        placeholder="经度 lng"
        size="small"
        @change="syncFromInput"
      >
        <template #prepend>经度</template>
      </el-input>
      <el-input
        v-model="latInput"
        placeholder="纬度 lat"
        size="small"
        @change="syncFromInput"
      >
        <template #prepend>纬度</template>
      </el-input>
      <el-button size="small" :disabled="!props.modelValue" @click="clearPoint">
        清空
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.coord-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.map {
  width: 100%;
  height: 320px;
  background: #0a1929;
  border-radius: 4px;
}
.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
}
</style>