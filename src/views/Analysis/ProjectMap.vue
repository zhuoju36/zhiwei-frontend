<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getOverview } from '@/api/dashboard'
import { formatNumber } from '@/utils/format'
import type { ProjectOverviewItem } from '@/types/dashboard'
import ProjectMapChart from '@/components/Analysis/ProjectMapChart.vue'

const usingMock = ref(false)
const projects = ref<ProjectOverviewItem[]>([])
const selected = ref<ProjectOverviewItem | null>(null)

/** 后端接口未就绪时的兜底 mock，便于独立走通前端；接口上线后删除 */
const MOCK: ProjectOverviewItem[] = [
  {
    id: 1,
    name: '钱塘江大桥监测',
    description: '主桥结构健康监测',
    location: { lat: 30.198, lng: 120.215, address: '浙江省杭州市' },
    device_stats: { total: 12, online: 11, offline: 0, error: 1 },
  },
  {
    id: 2,
    name: '北京大兴机场航站楼',
    description: null,
    location: { lat: 39.509, lng: 116.41, address: '北京市大兴区' },
    device_stats: { total: 28, online: 28, offline: 0, error: 0 },
  },
  {
    id: 3,
    name: '上海中心大厦',
    description: '超高层结构监测',
    location: { lat: 31.234, lng: 121.505, address: '上海市浦东新区' },
    device_stats: { total: 18, online: 14, offline: 3, error: 1 },
  },
  {
    id: 4,
    name: '广州塔',
    description: null,
    location: { lat: 23.106, lng: 113.323, address: '广东省广州市' },
    device_stats: { total: 6, online: 4, offline: 2, error: 0 },
  },
  {
    id: 5,
    name: '成都天府国际机场',
    description: null,
    location: { lat: 30.312, lng: 103.945, address: '四川省成都市' },
    device_stats: { total: 0, online: 0, offline: 0, error: 0 },
  },
  {
    id: 6,
    name: '未配置位置的样例项目',
    description: null,
    location: null,
    device_stats: { total: 3, online: 3, offline: 0, error: 0 },
  },
]

async function load(): Promise<void> {
  try {
    const res = await getOverview()
    projects.value = res.projects
    usingMock.value = false
  } catch {
    // 后端接口暂未上线，前端用 mock 兜底走通
    projects.value = MOCK
    usingMock.value = true
  }
}

onMounted(() => void load())

function onSelect(p: ProjectOverviewItem): void {
  selected.value = p
}

const locatedProjects = computed(() => projects.value.filter((p) => p.location != null))
const noLocationProjects = computed(() => projects.value.filter((p) => p.location == null))

const summary = computed(() => {
  let devices = 0
  let online = 0
  for (const p of projects.value) {
    devices += p.device_stats.total
    online += p.device_stats.online
  }
  return {
    total: projects.value.length,
    located: locatedProjects.value.length,
    devices,
    onlineRate: devices > 0 ? Math.round((online / devices) * 1000) / 10 : 0,
  }
})

function onlineRateText(stats: ProjectOverviewItem['device_stats']): string {
  if (stats.total === 0) return '-'
  return `${formatNumber((stats.online / stats.total) * 100, 1)}%`
}
</script>

<template>
  <div class="project-map-page">
    <el-alert
      v-if="usingMock"
      type="info"
      :closable="false"
      show-icon
      title="后端接口暂未上线，当前为前端 mock 数据"
    />

    <el-row :gutter="12" class="stats-row">
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">项目总数</div>
          <div class="stat-value">{{ summary.total }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">有位置项目</div>
          <div class="stat-value">{{ summary.located }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">设备总数</div>
          <div class="stat-value">{{ summary.devices }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">总体在线率</div>
          <div class="stat-value">{{ formatNumber(summary.onlineRate, 1) }}%</div>
        </el-card>
      </el-col>
    </el-row>

    <div class="map-row">
      <el-card shadow="never" class="map-card">
        <ProjectMapChart :projects="projects" class="chart" @select="onSelect" />
      </el-card>
      <el-card shadow="never" class="detail-card">
        <template v-if="selected">
          <h3 class="detail-title">{{ selected.name }}</h3>
          <div class="detail-desc">{{ selected.description || '（无描述）' }}</div>
          <el-descriptions :column="1" size="small" border class="detail-desc-list">
            <el-descriptions-item label="项目 ID">{{ selected.id }}</el-descriptions-item>
            <el-descriptions-item label="地址">
              {{ selected.location?.address ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="selected.location" label="坐标">
              {{ formatNumber(selected.location.lat, 4) }},
              {{ formatNumber(selected.location.lng, 4) }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="stat-blocks">
            <div class="stat-block">
              <div class="stat-block-label">总数</div>
              <div class="stat-block-value">{{ selected.device_stats.total }}</div>
            </div>
            <div class="stat-block online">
              <div class="stat-block-label">在线</div>
              <div class="stat-block-value">{{ selected.device_stats.online }}</div>
            </div>
            <div class="stat-block offline">
              <div class="stat-block-label">离线</div>
              <div class="stat-block-value">{{ selected.device_stats.offline }}</div>
            </div>
            <div class="stat-block error">
              <div class="stat-block-label">故障</div>
              <div class="stat-block-value">{{ selected.device_stats.error }}</div>
            </div>
          </div>
          <div class="online-rate">在线率 {{ onlineRateText(selected.device_stats) }}</div>
        </template>
        <el-empty v-else description="点击地图上的项目点查看详情" :image-size="80" />
      </el-card>
    </div>

    <el-card v-if="noLocationProjects.length > 0" shadow="never" class="fallback-card">
      <template #header>
        <span>无位置信息的项目（{{ noLocationProjects.length }}）</span>
      </template>
      <el-table :data="noLocationProjects" border size="small">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="设备" min-width="220">
          <template #default="{ row }">
            {{ row.device_stats.total }}（在线 {{ row.device_stats.online }} / 离线
            {{ row.device_stats.offline }} / 故障 {{ row.device_stats.error }}）
          </template>
        </el-table-column>
        <el-table-column label="在线率" width="120">
          <template #default="{ row }">{{ onlineRateText(row.device_stats) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.project-map-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-row {
  flex-shrink: 0;
}

.stat-card {
  text-align: center;
  .stat-label {
    color: #909399;
    font-size: 13px;
  }
  .stat-value {
    font-size: 26px;
    font-weight: 600;
    color: #303133;
    line-height: 1.4;
  }
}

.map-row {
  display: flex;
  gap: 12px;
  height: 520px;
}

.map-card {
  flex: 1;
  min-width: 0;
  :deep(.el-card__body) {
    padding: 8px;
  }
}

.chart {
  height: 488px;
  width: 100%;
}

.detail-card {
  flex: 0 0 360px;
  :deep(.el-card__body) {
    overflow-y: auto;
    max-height: 504px;
  }
}

.detail-title {
  margin: 0 0 4px;
  font-size: 18px;
  color: #303133;
}

.detail-desc {
  color: #606266;
  font-size: 13px;
  margin-bottom: 12px;
}

.detail-desc-list {
  margin-bottom: 16px;
}

.stat-blocks {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-block {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
  text-align: center;
  &.online { background: #f0f9eb; }
  &.offline { background: #f4f4f5; }
  &.error { background: #fef0f0; }
  .stat-block-label {
    color: #909399;
    font-size: 12px;
  }
  .stat-block-value {
    font-size: 22px;
    font-weight: 600;
    color: #303133;
    line-height: 1.3;
  }
}

.online-rate {
  margin-top: 12px;
  text-align: center;
  font-size: 13px;
  color: #606266;
}

.fallback-card {
  flex-shrink: 0;
}
</style>