<script setup lang="ts">
/**
 * 数据大屏左侧边栏：项目选择器 + 当前项目传感器列表。
 * 传感器列表随 dashboardStore.currentProjectId 自动响应更新
 * （store 内部已实现 project→devices→sensors 的串联加载）。
 */
import { computed, ref } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import type { Sensor } from '@/types'

const dashboardStore = useDashboardStore()

const search = ref('')
const selectedSensorId = ref<number | null>(null)

/** 传感器展示列表：按搜索关键字过滤 sensor_code/name/type */
const filteredSensors = computed<Sensor[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return dashboardStore.sensors
  return dashboardStore.sensors.filter(
    (s) =>
      s.sensor_code.toLowerCase().includes(q) ||
      (s.sensor_name?.toLowerCase().includes(q) ?? false) ||
      (s.sensor_type?.toLowerCase().includes(q) ?? false),
  )
})

/** 是否有绑定三维坐标（用于 3D 场景标记） */
function hasPosition(s: Sensor): boolean {
  return s.position != null
}

function onProjectChange(id: number): void {
  dashboardStore.selectProject(id)
  selectedSensorId.value = null
}
</script>

<template>
  <div class="sensor-sidebar">
    <!-- 项目选择器 -->
    <div class="block">
      <div class="block-title">项目</div>
      <el-select
        :model-value="dashboardStore.currentProjectId ?? undefined"
        placeholder="选择项目"
        class="project-select"
        @change="onProjectChange"
      >
        <el-option
          v-for="p in dashboardStore.projects"
          :key="p.id"
          :label="p.name"
          :value="p.id"
        />
      </el-select>
    </div>

    <!-- 传感器列表 -->
    <div class="block block-flex">
      <div class="block-title">
        <span>传感器</span>
        <span class="count">{{ dashboardStore.sensors.length }}</span>
      </div>
      <el-input
        v-model="search"
        placeholder="搜索编码 / 名称 / 类型"
        clearable
        size="small"
        class="search-input"
      />
      <div class="list" v-loading="dashboardStore.loading">
        <div v-if="filteredSensors.length === 0" class="empty">
          {{ dashboardStore.sensors.length === 0 ? '该项目暂无传感器' : '无匹配项' }}
        </div>
        <div
          v-for="s in filteredSensors"
          :key="s.id"
          class="item"
          :class="{ active: selectedSensorId === s.id }"
          @click="selectedSensorId = s.id"
        >
          <div class="item-row1">
            <span class="code">{{ s.sensor_code }}</span>
            <el-tag
              v-if="hasPosition(s)"
              size="small"
              type="success"
              effect="plain"
              class="tag-3d"
            >
              3D
            </el-tag>
          </div>
          <div class="item-row2">
            <span class="name">{{ s.sensor_name ?? '-' }}</span>
            <span class="type">{{ s.sensor_type ?? '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sensor-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  width: 100%;
  min-height: 0;
  color: #d8e3ff;
}

.block {
  flex-shrink: 0;
}

.block-flex {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.block-title {
  font-size: 12px;
  color: #8aa3c8;
  letter-spacing: 2px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .count {
    background: rgba(61, 231, 201, 0.18);
    color: #3de7c9;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    font-weight: 500;
  }
}

.project-select {
  width: 100%;
}

.search-input {
  margin-bottom: 8px;
}

.list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 4px;

  /* 滚动条样式（暗色） */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(61, 231, 201, 0.3);
    border-radius: 3px;
  }
}

.empty {
  text-align: center;
  color: #8aa3c8;
  font-size: 12px;
  padding: 20px 8px;
}

.item {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;

  &:hover {
    background: rgba(61, 231, 201, 0.08);
  }

  &.active {
    background: rgba(61, 231, 201, 0.16);
    border-left-color: #3de7c9;
  }

  + .item {
    margin-top: 2px;
  }
}

.item-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 13px;

  .code {
    color: #d8e3ff;
    font-weight: 600;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  }
}

.item-row2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 11px;
  color: #8aa3c8;

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 0;
    min-width: 0;
  }
  .type {
    margin-left: 6px;
    opacity: 0.75;
  }
}

.tag-3d {
  flex-shrink: 0;
}
</style>