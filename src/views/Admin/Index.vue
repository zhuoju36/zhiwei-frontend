<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Aim, Connection, Document, Files, Monitor, SetUp, User } from '@element-plus/icons-vue'
import AppHeader from '@/components/Common/AppHeader.vue'

const route = useRoute()
const activePath = computed(() => route.path)
</script>

<template>
  <el-container class="admin-page">
    <AppHeader />
    <el-container class="admin-body">
      <el-aside width="200px" class="admin-aside">
        <el-menu :default-active="activePath" router class="aside-menu">
          <el-menu-item index="/admin/subitems">
            <el-icon><Files /></el-icon>
            <span>子项管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/devices">
            <el-icon><Monitor /></el-icon>
            <span>设备管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/points">
            <el-icon><Aim /></el-icon>
            <span>测点管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/sensors">
            <el-icon><SetUp /></el-icon>
            <span>传感器管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/channels">
            <el-icon><Connection /></el-icon>
            <span>通道管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/plugins">
            <el-icon><Connection /></el-icon>
            <span>插件管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/logs">
            <el-icon><Document /></el-icon>
            <span>日志管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.admin-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.admin-body {
  flex: 1;
  min-height: 0;
}

.admin-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;

  .aside-menu {
    border-right: none;
  }
}

.admin-main {
  padding: 16px;
}
</style>
