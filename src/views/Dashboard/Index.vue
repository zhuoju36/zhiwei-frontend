<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import AppHeader from '@/components/Common/AppHeader.vue'
import Scene3D from './Scene3D.vue'
import PointPanel from './PointPanel.vue'
import ChartStrip from './ChartStrip.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

onMounted(async () => {
  await dashboardStore.fetchProjects()
  if (dashboardStore.currentProjectId != null) {
    wsStore.subscribeProject(dashboardStore.currentProjectId)
  } else {
    wsStore.connect()
  }
})

// 切换项目后重新订阅（后端不支持改订阅，需重连）
watch(
  () => dashboardStore.currentProjectId,
  (id) => {
    if (id != null) wsStore.subscribeProject(id)
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
        <Scene3D :model-file-key="dashboardStore.currentProject?.model_file_key ?? null" />
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
