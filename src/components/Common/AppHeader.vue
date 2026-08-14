<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SwitchButton } from '@element-plus/icons-vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useUserStore } from '@/stores/user'
import { useWebSocketStore } from '@/stores/websocket'

const route = useRoute()
const router = useRouter()
const dashboardStore = useDashboardStore()
const userStore = useUserStore()
const wsStore = useWebSocketStore()

const activePath = computed(() => {
  // 数据分析/系统管理子路由统一高亮其入口
  if (route.path.startsWith('/analysis')) return '/analysis/realtime'
  if (route.path.startsWith('/admin')) return '/admin/points'
  return route.path
})

onMounted(() => {
  if (dashboardStore.subitems.length === 0) {
    void dashboardStore.fetchSubitems()
  }
})

function onSubitemChange(id: number): void {
  dashboardStore.selectSubitem(id)
  wsStore.subscribeSubitem(id)
}

function logout(): void {
  wsStore.disconnect()
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-header class="app-header" height="56px">
    <div class="left">
      <span class="logo">SHM 结构健康监测</span>
      <el-menu
        mode="horizontal"
        :default-active="activePath"
        router
        :ellipsis="false"
        class="nav"
      >
        <el-menu-item index="/">数据大屏</el-menu-item>
        <el-menu-item index="/analysis/realtime">数据分析</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/admin/points">系统管理</el-menu-item>
      </el-menu>
    </div>
    <div class="right">
      <el-select
        :model-value="dashboardStore.currentSubitemId"
        placeholder="选择子项"
        class="subitem-select"
        @change="onSubitemChange"
      >
        <el-option v-for="s in dashboardStore.subitems" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-tag :type="wsStore.isConnected ? 'success' : 'info'" size="small">
        {{ wsStore.isConnected ? '实时已连接' : '实时未连接' }}
      </el-tag>
      <span class="user">用户 #{{ userStore.userId ?? '-' }}（{{ userStore.role || '-' }}）</span>
      <el-button :icon="SwitchButton" text @click="logout">退出</el-button>
    </div>
  </el-header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  padding: 0 16px;
}

.left {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 100%;
}

.logo {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.nav {
  border-bottom: none;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.subitem-select {
  width: 200px;
}

.user {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
</style>
