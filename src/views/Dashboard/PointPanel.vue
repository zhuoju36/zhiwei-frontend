<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { UNKNOWN_COLOR, qualityColor } from '@/utils/color'
import { formatTime, formatValue } from '@/utils/format'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

// 兜底：WS 实时流中出现但测点列表没有的 point_id
const fallbackIds = computed<number[]>(() =>
  wsStore.knownPointIds.filter((id) => !dashboardStore.pointMap.has(id)),
)

const totalCount = computed(() => dashboardStore.points.length + fallbackIds.value.length)

function onSelect(id: number): void {
  dashboardStore.selectPoint(id)
}
</script>

<template>
  <div v-loading="dashboardStore.pointsLoading" class="point-panel">
    <div class="panel-title">实时测点（{{ totalCount }}）</div>
    <el-empty v-if="totalCount === 0" description="暂无测点" :image-size="60" />
    <div v-else class="point-list">
      <div
        v-for="p in dashboardStore.points"
        :key="p.id"
        class="point-item"
        :class="{ active: dashboardStore.selectedPointId === p.id }"
        @click="onSelect(p.id)"
      >
        <div class="point-head">
          <span class="point-name">{{ p.point_name }}</span>
          <el-tag
            size="small"
            effect="dark"
            :color="wsStore.latestData[p.id] ? qualityColor(wsStore.latestData[p.id].quality) : UNKNOWN_COLOR"
            class="quality-tag"
          >
            {{ wsStore.latestData[p.id]?.quality ?? '暂无数据' }}
          </el-tag>
        </div>
        <div class="point-sub">{{ p.point_code }} · {{ p.point_type }}</div>
        <div class="point-value">
          <template v-if="wsStore.latestData[p.id]">
            {{ formatValue(wsStore.latestData[p.id].value, wsStore.latestData[p.id].unit || p.unit) }}
          </template>
          <span v-else class="no-data">暂无数据</span>
        </div>
        <div v-if="wsStore.latestData[p.id]" class="point-time">
          {{ formatTime(wsStore.latestData[p.id].timestamp) }}
        </div>
      </div>
      <div
        v-for="id in fallbackIds"
        :key="id"
        class="point-item"
        :class="{ active: dashboardStore.selectedPointId === id }"
        @click="onSelect(id)"
      >
        <div class="point-head">
          <span class="point-name">测点 #{{ id }}</span>
          <el-tag
            size="small"
            effect="dark"
            :color="qualityColor(wsStore.latestData[id].quality)"
            class="quality-tag"
          >
            {{ wsStore.latestData[id].quality }}
          </el-tag>
        </div>
        <div class="point-value">
          {{ formatValue(wsStore.latestData[id].value, wsStore.latestData[id].unit) }}
        </div>
        <div class="point-time">{{ formatTime(wsStore.latestData[id].timestamp) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.point-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-title {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
}

.point-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.point-item {
  padding: 8px 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    border-color: #409eff;
  }

  &.active {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.point-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.point-name {
  font-size: 13px;
  font-weight: 600;
}

.quality-tag {
  border: none;
  color: #fff;
}

.point-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.point-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
}

.no-data {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

.point-time {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}
</style>
