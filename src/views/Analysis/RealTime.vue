<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TimeSeries from '@/components/Charts/TimeSeries.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

// 通道列表可下拉选择，也可手动输入通道 ID
const selected = ref<(number | string)[]>([])
const channelIds = computed<number[]>(() =>
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
      placeholder="选择通道，或输入通道 ID 回车添加"
      class="channel-select"
    >
      <el-option
        v-for="c in dashboardStore.channels"
        :key="c.id"
        :label="`${c.channel_code}（#${c.id}）`"
        :value="c.id"
      />
    </el-select>
    <TimeSeries :channel-ids="channelIds" :minutes="30" live height="calc(100vh - 260px)" class="chart" />
  </div>
</template>

<style scoped lang="scss">
.realtime-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-select {
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
