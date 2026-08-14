<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Bell, Clock, Histogram, Monitor, Setting, TrendCharts } from '@element-plus/icons-vue'
import AppHeader from '@/components/Common/AppHeader.vue'

const route = useRoute()
const activePath = computed(() => route.path)
</script>

<template>
  <el-container class="analysis-page">
    <AppHeader />
    <el-container class="analysis-body">
      <el-aside width="200px" class="analysis-aside">
        <el-menu :default-active="activePath" router class="aside-menu">
          <el-menu-item index="/analysis/realtime">
            <el-icon><Monitor /></el-icon>
            <span>实时监测</span>
          </el-menu-item>
          <el-menu-item index="/analysis/history">
            <el-icon><Clock /></el-icon>
            <span>历史查询</span>
          </el-menu-item>
          <el-menu-item index="/analysis/spectrum">
            <el-icon><Histogram /></el-icon>
            <span>分析任务</span>
          </el-menu-item>
          <el-menu-item index="/analysis/evaluation">
            <el-icon><TrendCharts /></el-icon>
            <span>数据评估</span>
          </el-menu-item>
          <el-menu-item index="/analysis/alert-log">
            <el-icon><Bell /></el-icon>
            <span>预警日志</span>
          </el-menu-item>
          <el-menu-item index="/analysis/notify-setting">
            <el-icon><Setting /></el-icon>
            <span>通知设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="analysis-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.analysis-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.analysis-body {
  flex: 1;
  min-height: 0;
}

.analysis-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;

  .aside-menu {
    border-right: none;
  }
}

.analysis-main {
  padding: 16px;
}
</style>
