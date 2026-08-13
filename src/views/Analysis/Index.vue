<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/Common/AppHeader.vue'

const route = useRoute()
const activePath = computed(() => route.path)
</script>

<template>
  <el-container class="analysis-page">
    <AppHeader />
    <div class="sub-nav">
      <el-menu mode="horizontal" :default-active="activePath" router :ellipsis="false">
        <el-menu-item index="/analysis/realtime">实时监测</el-menu-item>
        <el-menu-item index="/analysis/history">历史查询</el-menu-item>
      </el-menu>
    </div>
    <el-main class="analysis-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped lang="scss">
.analysis-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sub-nav {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 16px;

  :deep(.el-menu) {
    border-bottom: none;
  }
}

.analysis-main {
  flex: 1;
  min-height: 0;
  padding: 16px;
}
</style>
