<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppHeader from '@/components/Common/AppHeader.vue'
import Scene3D from './Scene3D.vue'
import PointPanel from './PointPanel.vue'
import ChartStrip from './ChartStrip.vue'
import { getStats, type DashboardStats } from '@/api/dashboard'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { formatTime } from '@/utils/format'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

const stats = ref<DashboardStats | null>(null)
const statsLoading = ref(false)

const levelColor = (level: string): string => {
  switch (level) {
    case 'danger':
      return '#F56C6C'
    case 'warning':
      return '#E6A23C'
    default:
      return '#909399'
  }
}

async function loadStats(): Promise<void> {
  const id = dashboardStore.currentProjectId
  if (id == null) {
    stats.value = null
    return
  }
  statsLoading.value = true
  try {
    stats.value = await getStats(id)
  } catch {
    // 错误提示由请求拦截器统一处理
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}

onMounted(async () => {
  await dashboardStore.fetchProjects()
  if (dashboardStore.currentProjectId != null) {
    wsStore.subscribeProject(dashboardStore.currentProjectId)
  } else {
    wsStore.connect()
  }
})

// 切换项目后重新订阅（后端不支持改订阅，需重连）并刷新统计
watch(
  () => dashboardStore.currentProjectId,
  (id) => {
    if (id != null) wsStore.subscribeProject(id)
    void loadStats()
  },
)

onBeforeUnmount(() => {
  wsStore.disconnect()
})
</script>

<template>
  <el-container class="dashboard">
    <AppHeader />
    <el-container class="dashboard-main">
      <el-main class="scene-area">
        <el-row v-loading="statsLoading" :gutter="12" class="stats-row">
          <el-col :span="6">
            <el-card shadow="never" class="stat-card">
              <div class="stat-label">活跃告警</div>
              <div class="stat-value danger">{{ stats?.active_alerts ?? '-' }}</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never" class="stat-card">
              <div class="stat-label">近 24h 告警</div>
              <div class="stat-value">{{ stats?.alerts_24h ?? '-' }}</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never" class="stat-card">
              <div class="stat-label">告警分布</div>
              <div class="stat-value">
                <span class="level-chip" :style="{ color: levelColor('warning') }">
                  警告 {{ stats?.by_level?.warning ?? 0 }}
                </span>
                <span class="level-chip" :style="{ color: levelColor('danger') }">
                  危险 {{ stats?.by_level?.danger ?? 0 }}
                </span>
                <span class="level-chip">信息 {{ stats?.by_level?.info ?? 0 }}</span>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="never" class="stat-card">
              <div class="stat-label">最新告警</div>
              <div v-if="stats?.recent_alerts?.length" class="stat-value small">
                <div v-for="a in stats.recent_alerts.slice(0, 2)" :key="a.id" class="recent-alert">
                  <el-tag size="small" effect="dark" :color="levelColor(a.level)">
                    {{ a.level }}
                  </el-tag>
                  <span class="recent-msg">{{ a.message || '通道 #' + a.channel_id }}</span>
                  <span class="recent-time">{{ formatTime(a.started_at, false) }}</span>
                </div>
              </div>
              <div v-else class="stat-value small empty">暂无</div>
            </el-card>
          </el-col>
        </el-row>
        <Scene3D :model-id="dashboardStore.currentModel?.id ?? null" />
      </el-main>
      <el-aside width="320px" class="panel-area">
        <PointPanel />
      </el-aside>
    </el-container>
    <el-footer height="280px" class="chart-area">
      <ChartStrip />
    </el-footer>
  </el-container>
</template>

<style scoped lang="scss">
.dashboard {
  height: 100%;
}

.dashboard-main {
  flex: 1;
  min-height: 0;
}

.scene-area {
  padding: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stats-row {
  padding: 8px 12px 0;
  flex-shrink: 0;
}

.stat-card {
  .stat-label {
    font-size: 12px;
    color: #909399;
  }

  .stat-value {
    margin-top: 4px;
    font-size: 22px;
    font-weight: 600;

    &.danger {
      color: #f56c6c;
    }

    &.small {
      font-size: 13px;
      font-weight: 400;
    }

    .level-chip {
      margin-right: 8px;
    }

    .empty {
      color: #909399;
    }
  }
}

.recent-alert {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;

  .recent-msg {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-time {
    color: #909399;
    font-size: 12px;
  }
}

.panel-area {
  border-left: 1px solid #e4e7ed;
  background: #fff;
}

.chart-area {
  padding: 0;
  border-top: 1px solid #e4e7ed;
  background: #fff;
}
</style>
