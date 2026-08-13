<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TimeSeries from '@/components/Charts/TimeSeries.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

// 测点列表可下拉选择，也可手动输入测点 ID
const selected = ref<(number | string)[]>([])
const pointIds = computed<number[]>(() =>
  selected.value.map(Number).filter((n) => Number.isInteger(n) && n > 0),
)

onMounted(async () => {
  if (dashboardStore.projects.length === 0) {
    await dashboardStore.fetchProjects()
  }
  if (dashboardStore.currentProjectId != null) {
    wsStore.subscribeProject(dashboardStore.currentProjectId)
  } else {
    wsStore.connect()
  }
})

onBeforeUnmount(() => {
  wsStore.disconnect()
})
</script>

<template>
  <div class="realtime-page">
    <el-select
      v-model="selected"
      multiple
      filterable
      allow-create
      default-first-option
      placeholder="选择测点，或输入测点 ID 回车添加"
      class="point-select"
    >
      <el-option
        v-for="p in dashboardStore.points"
        :key="p.id"
        :label="`${p.point_name}（#${p.id}）`"
        :value="p.id"
      />
    </el-select>
    <TimeSeries :point-ids="pointIds" :minutes="30" live height="calc(100vh - 260px)" class="chart" />
  </div>
</template>

<style scoped lang="scss">
.realtime-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.point-select {
  width: 100%;
}

.chart {
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 4px;
  padding: 8px;
}
</style>
