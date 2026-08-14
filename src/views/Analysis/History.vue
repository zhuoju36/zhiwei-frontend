<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getTimeseries } from '@/api/data'
import { useDashboardStore } from '@/stores/dashboard'
import { formatNumber, formatTime } from '@/utils/format'
import type { TimeInterval, TimeSeriesItem } from '@/types'

const dashboardStore = useDashboardStore()

const channelId = ref<number | string>('')
const range = ref<[Date, Date]>([new Date(Date.now() - 3600_000), new Date()])
const interval = ref<TimeInterval>('1m')
const loading = ref(false)
const rows = ref<TimeSeriesItem[]>([])
const resultInfo = ref('')

const intervalOptions: TimeInterval[] = ['raw', '100ms', '1s', '1m', '1h', '1d']

async function query(): Promise<void> {
  const cid = Number(channelId.value)
  if (!Number.isInteger(cid) || cid <= 0) {
    ElMessage.warning('请选择通道')
    return
  }
  if (!range.value || range.value.length !== 2) {
    ElMessage.warning('请选择时间范围')
    return
  }
  loading.value = true
  try {
    const res = await getTimeseries({
      channel_id: cid,
      start: range.value[0].toISOString(),
      end: range.value[1].toISOString(),
      interval: interval.value,
    })
    rows.value = res.data
    resultInfo.value = `${dashboardStore.channelName(res.channel_id)}，间隔 ${res.interval}，共 ${res.data.length} 条`
  } catch {
    // 错误提示由请求拦截器统一处理
    rows.value = []
    resultInfo.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="history-page">
    <el-form inline class="query-form">
      <el-form-item label="通道">
        <el-select
          v-model="channelId"
          filterable
          allow-create
          default-first-option
          placeholder="选择通道，或输入通道 ID"
          class="channel-select"
        >
          <el-option
            v-for="c in dashboardStore.channels"
            :key="c.id"
            :label="`${c.channel_code}（#${c.id}）`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="range"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item label="聚合间隔">
        <el-select v-model="interval" class="interval-select">
          <el-option v-for="opt in intervalOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="query">查询</el-button>
      </el-form-item>
    </el-form>

    <div v-if="resultInfo" class="result-info">{{ resultInfo }}</div>

    <el-table v-loading="loading" :data="rows" border height="calc(100vh - 320px)">
      <el-table-column label="时间" min-width="180">
        <template #default="{ row }">{{ formatTime(row.ts) }}</template>
      </el-table-column>
      <el-table-column label="值（raw）" min-width="110">
        <template #default="{ row }">{{ formatNumber(row.value) }}</template>
      </el-table-column>
      <el-table-column label="平均值" min-width="110">
        <template #default="{ row }">{{ formatNumber(row.avg_val) }}</template>
      </el-table-column>
      <el-table-column label="最大值" min-width="110">
        <template #default="{ row }">{{ formatNumber(row.max_val) }}</template>
      </el-table-column>
      <el-table-column label="最小值" min-width="110">
        <template #default="{ row }">{{ formatNumber(row.min_val) }}</template>
      </el-table-column>
      <el-table-column label="RMS" min-width="110">
        <template #default="{ row }">{{ formatNumber(row.rms_val) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.history-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-form {
  padding: 12px 12px 0;
  background: #fff;
  border-radius: 4px;
}

.channel-select {
  width: 220px;
}

.interval-select {
  width: 110px;
}

.result-info {
  font-size: 13px;
  color: #606266;
}
</style>
