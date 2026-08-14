<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { acknowledgeAlert, listAlerts } from '@/api/alert'
import { useDashboardStore } from '@/stores/dashboard'
import { formatNumber, formatTime } from '@/utils/format'
import type { Alert, AlertLevel } from '@/types'

const dashboardStore = useDashboardStore()

const loading = ref(false)
const rows = ref<Alert[]>([])
const total = ref(0)
const page = ref(1)
const size = 20

const query = reactive({
  level: '' as AlertLevel | '',
  isResolved: '' as boolean | '',
  range: null as [Date, Date] | null,
})

const levelTag = (level: string): 'info' | 'warning' | 'danger' =>
  level === 'danger' ? 'danger' : level === 'warning' ? 'warning' : 'info'

async function load(): Promise<void> {
  // 前端始终传 project_id（不传时后端不过滤、admin 可见全量）
  loading.value = true
  try {
    const res = await listAlerts({
      project_id: dashboardStore.currentProjectId ?? undefined,
      level: query.level || undefined,
      is_resolved: query.isResolved === '' ? undefined : query.isResolved,
      start: query.range?.[0].toISOString(),
      end: query.range?.[1].toISOString(),
      page: page.value,
      size,
    })
    rows.value = res.items
    total.value = res.total
  } catch {
    // 错误提示由请求拦截器统一处理
    rows.value = []
  } finally {
    loading.value = false
  }
}

function search(): void {
  page.value = 1
  void load()
}

function reset(): void {
  query.level = ''
  query.isResolved = ''
  query.range = null
  page.value = 1
  void load()
}

async function acknowledge(row: Alert): Promise<void> {
  try {
    await acknowledgeAlert(row.id)
    ElMessage.success('已确认处理')
    await load()
  } catch (err) {
    if ((err as { response?: { status?: number } }).response?.status === 403) {
      ElMessage.error('无权限处理该告警（需要项目 admin）')
    }
  }
}

onMounted(async () => {
  if (dashboardStore.projects.length === 0) {
    await dashboardStore.fetchProjects()
  }
  void load()
})
</script>

<template>
  <div class="alert-log-page">
    <el-form inline class="query-form">
      <el-form-item label="级别">
        <el-select v-model="query.level" placeholder="全部" class="filter-select" clearable>
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="危险" value="danger" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.isResolved" placeholder="全部" class="filter-select" clearable>
          <el-option label="未处理" :value="false" />
          <el-option label="已处理" :value="true" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="query.range"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      height="calc(100vh - 280px)"
      @row-dblclick="acknowledge"
    >
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="levelTag(row.level)" effect="dark" size="small">{{ row.level }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="通道" width="120">
        <template #default="{ row }">
          {{ dashboardStore.channelName(row.channel_id) }}
        </template>
      </el-table-column>
      <el-table-column label="消息" min-width="200">
        <template #default="{ row }">{{ row.message || '-' }}</template>
      </el-table-column>
      <el-table-column label="值 / 阈值" width="140">
        <template #default="{ row }">
          {{ formatNumber(row.value) }} / {{ formatNumber(row.threshold) }}
        </template>
      </el-table-column>
      <el-table-column label="开始时间" width="170">
        <template #default="{ row }">{{ formatTime(row.started_at) }}</template>
      </el-table-column>
      <el-table-column label="结束时间" width="170">
        <template #default="{ row }">{{ formatTime(row.ended_at) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_resolved ? 'success' : 'danger'" size="small">
            {{ row.is_resolved ? '已处理' : '未处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="!row.is_resolved"
            size="small"
            type="primary"
            text
            @click="acknowledge(row)"
          >
            确认处理
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="total, prev, pager, next"
      class="pager"
      @current-change="load"
    />
  </div>
</template>

<style scoped lang="scss">
.alert-log-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-form {
  padding: 12px 12px 0;
  background: #fff;
  border-radius: 4px;
}

.filter-select {
  width: 120px;
}

.pager {
  justify-content: flex-end;
}
</style>
