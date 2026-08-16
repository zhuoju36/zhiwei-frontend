<script setup lang="ts">
/**
 * 设备状态：按项目列出设备及其实时状态（online / offline / error）。
 * 后端 /devices 接口本身已含 status 与 last_seen，无需额外汇总接口。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listAllDevices, updateDevice } from '@/api/device'
import { useDashboardStore } from '@/stores/dashboard'
import { formatTime } from '@/utils/format'
import type { Device, DeviceStatus } from '@/types'

const dashboardStore = useDashboardStore()

const loading = ref(false)
const devices = ref<Device[]>([])
const lastFetchAt = ref<Date | null>(null)

const filter = reactive({
  keyword: '',
  status: '' as DeviceStatus | '',
})

const tagType: Record<DeviceStatus, 'success' | 'info' | 'danger'> = {
  online: 'success',
  offline: 'info',
  error: 'danger',
}
const statusLabel: Record<DeviceStatus, string> = {
  online: '在线',
  offline: '离线',
  error: '异常',
}

let pollTimer: ReturnType<typeof setInterval> | null = null

/** 统计：按状态聚合 */
const stats = computed(() => {
  const list = devices.value
  return {
    total: list.length,
    online: list.filter((d) => d.status === 'online').length,
    offline: list.filter((d) => d.status === 'offline').length,
    error: list.filter((d) => d.status === 'error').length,
  }
})

/** 过滤后的设备列表（按状态/关键字） */
const filtered = computed(() => {
  const q = filter.keyword.trim().toLowerCase()
  return devices.value.filter((d) => {
    if (filter.status && d.status !== filter.status) return false
    if (!q) return true
    return (
      d.device_code.toLowerCase().includes(q) ||
      (d.device_name?.toLowerCase().includes(q) ?? false) ||
      d.protocol.toLowerCase().includes(q)
    )
  })
})

async function load(): Promise<void> {
  const pid = dashboardStore.currentProjectId
  if (pid == null) {
    devices.value = []
    return
  }
  loading.value = true
  try {
    devices.value = await listAllDevices(pid)
    lastFetchAt.value = new Date()
  } catch {
    // 错误由请求拦截器统一提示
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (dashboardStore.projects.length === 0) {
    await dashboardStore.fetchProjects()
  }
  await load()
  // 每 30s 拉取最新状态
  pollTimer = setInterval(() => void load(), 30_000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

// 切换项目时重新加载
watch(
  () => dashboardStore.currentProjectId,
  () => {
    void load()
  },
)

/** 把异常设备标回离线（运维场景） */
async function markOffline(d: Device): Promise<void> {
  try {
    await updateDevice(d.id, { status: 'offline' })
    ElMessage.success(`设备 ${d.device_code} 已标记为离线`)
    await load()
  } catch {
    // 错误提示由请求拦截器处理
  }
}
</script>

<template>
  <div class="device-status-page">
    <!-- 顶部统计 -->
    <el-row :gutter="12" class="stats-row">
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">设备总数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card online">
          <div class="stat-label">在线</div>
          <div class="stat-value">{{ stats.online }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card offline">
          <div class="stat-label">离线</div>
          <div class="stat-value">{{ stats.offline }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card error">
          <div class="stat-label">异常</div>
          <div class="stat-value">{{ stats.error }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 过滤栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form inline :model="filter">
        <el-form-item label="项目">
          <el-select
            :model-value="dashboardStore.currentProjectId ?? undefined"
            placeholder="选择项目"
            class="project-select"
            @change="(id: number) => dashboardStore.selectProject(id)"
          >
            <el-option
              v-for="p in dashboardStore.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable class="status-select">
            <el-option label="在线" value="online" />
            <el-option label="离线" value="offline" />
            <el-option label="异常" value="error" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filter.keyword"
            placeholder="编码 / 名称 / 协议"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
        </el-form-item>
        <el-form-item v-if="lastFetchAt" class="last-fetch">
          <span class="muted">
            最近更新：{{ formatTime(lastFetchAt.toISOString(), true) }}
          </span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 设备表 -->
    <el-card shadow="never" v-loading="loading" class="table-card">
      <el-table :data="filtered" border empty-text="该项目暂无设备">
        <el-table-column prop="device_code" label="设备编码" min-width="140" show-overflow-tooltip />
        <el-table-column prop="device_name" label="名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.device_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType[row.status as DeviceStatus]" size="small">
              {{ statusLabel[row.status as DeviceStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后上报" min-width="160">
          <template #default="{ row }">
            {{ row.last_seen ? formatTime(row.last_seen, true) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.note || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'error'"
              link
              type="primary"
              size="small"
              @click="markOffline(row)"
            >
              标记离线
            </el-button>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.device-status-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  position: relative;
  overflow: hidden;

  .stat-label {
    font-size: 13px;
    color: #909399;
  }

  .stat-value {
    margin-top: 4px;
    font-size: 26px;
    font-weight: 600;
    color: #303133;
  }

  &.online .stat-value { color: #67c23a; }
  &.offline .stat-value { color: #909399; }
  &.error .stat-value { color: #f56c6c; }
}

.filter-card {
  .project-select { width: 220px; }
  .status-select { width: 140px; }
  .search-input { width: 220px; }
  .last-fetch { margin-left: auto; }
}

.muted {
  color: #909399;
  font-size: 12px;
}
</style>
