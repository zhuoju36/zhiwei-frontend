<script setup lang="ts">
import { computed } from 'vue'
import TimeSeries from '@/components/Charts/TimeSeries.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboardStore = useDashboardStore()

const pointIds = computed<number[]>(() =>
  dashboardStore.selectedPointId != null ? [dashboardStore.selectedPointId] : [],
)
</script>

<template>
  <div class="chart-strip">
    <div class="strip-title">
      实时曲线
      <span v-if="dashboardStore.selectedPointId != null" class="strip-sub">
        测点 #{{ dashboardStore.selectedPointId }}（近 1 小时 + 实时追加）
      </span>
      <span v-else class="strip-sub">在右侧点击测点查看曲线</span>
    </div>
    <TimeSeries :point-ids="pointIds" :minutes="60" live height="222px" />
  </div>
</template>

<style scoped lang="scss">
.chart-strip {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
}

.strip-title {
  font-weight: 600;
  line-height: 32px;
}

.strip-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
</style>
