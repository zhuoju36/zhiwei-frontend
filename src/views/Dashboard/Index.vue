<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppFooter from '@/components/Common/AppFooter.vue'
import { getPlatform } from '@/api/platform'
import type { PlatformInfo } from '@/types'
import Scene3D from './Scene3D.vue'
import SensorSidebar from './SensorSidebar.vue'
import PointPanel from './PointPanel.vue'
import ChartStrip from './ChartStrip.vue'
import { getStats, type DashboardStats } from '@/api/dashboard'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { formatTime } from '@/utils/format'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()
const router = useRouter()

const stats = ref<DashboardStats | null>(null)
const statsLoading = ref(false)
const platformInfo = ref<PlatformInfo | null>(null)

/** 标题显示：优先取后端平台名称，失败回退到默认值 */
const platformName = computed(
  () => platformInfo.value?.platform_name?.trim() || '结构健康监测平台',
)
const platformTagline = computed(
  () => platformInfo.value?.description?.trim() || 'Powered by ZhiweiSHM',
)


/** 标题栏右侧时钟：实时刷新日期 + 星期 + 时间 */
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null
const timeText = computed(() => {
  const d = now.value
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} 星期${WEEKDAYS[d.getDay()]} ${hh}:${mi}:${ss}`
})

async function loadStats(): Promise<void> {
  const id = dashboardStore.currentProjectId
  if (id == null) {
    stats.value = null
    return
  }
  statsLoading.value = true
  try {
    stats.value = await getStats(id)
  } catch {
    // 错误提示由请求拦截器统一处理
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}

onMounted(async () => {
  // 标题栏时钟每秒刷新
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  // 拉取平台信息（失败静默，标题会回退到默认值）
  getPlatform()
    .then((p) => {
      platformInfo.value = p
    })
    .catch(() => {
      platformInfo.value = null
    })
  await dashboardStore.fetchProjects()
  if (dashboardStore.currentProjectId != null) {
    wsStore.subscribeProject(dashboardStore.currentProjectId)
  } else {
    wsStore.connect()
  }
})

// 切换项目后重新订阅（后端不支持改订阅，需重连）并刷新统计
watch(
  () => dashboardStore.currentProjectId,
  (id) => {
    if (id != null) wsStore.subscribeProject(id)
    void loadStats()
  },
)

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  wsStore.disconnect()
})

// ----- DataV 配置 -----

/** 数字大屏主色：用于边框四角高亮、文字色 */
const BORDER_COLOR = ['#3de7c9', '#235fa7']

/** 数字大屏翻牌器统一样式：字号 28、留足间距，避免窄框溢出 */
const FLOP_TEXT_STYLE = { fontSize: 28, fontWeight: 700 } as const

const activeFlopConfig = computed(() => ({
  number: [stats.value?.active_alerts ?? 0],
  content: '{nt} 起',
  style: { ...FLOP_TEXT_STYLE, fill: '#F56C6C' },
  toFixed: 0,
}))

const alerts24hFlopConfig = computed(() => ({
  number: [stats.value?.alerts_24h ?? 0],
  content: '{nt} 次',
  style: { ...FLOP_TEXT_STYLE, fill: '#E6A23C' },
  fontSize: 12,
}))

/** 告警分布：自定义迷你柱图（DataV CapsuleChart 在窄框内溢出不稳定，改用 CSS 柱图） */
const capsuleItems = computed(() => {
  const byLevel = stats.value?.by_level ?? { info: 0, warning: 0, danger: 0 }
  const items = [
    { name: '警告', value: byLevel.warning ?? 0, color: '#E6A23C' },
    { name: '危险', value: byLevel.danger ?? 0, color: '#F56C6C' },
    { name: '信息', value: byLevel.info ?? 0, color: '#909399' },
  ]
  const max = Math.max(1, ...items.map((it) => it.value))
  return items.map((it) => ({ ...it, width: max > 0 ? (it.value / max) * 100 : 0 }))
})

/** 最新告警排行：取最近 10 条横向条形；按时间倒序已天然有序 */
const recentAlertsConfig = computed(() => {
  const items = (stats.value?.recent_alerts ?? []).slice(0, 10)
  const dotColor = (level: string): string => {
    if (level === 'danger') return '#F56C6C'
    if (level === 'warning') return '#E6A23C'
    return '#909399'
  }
  return {
    data: items.map((a) => {
      const label = a.message || `通道 #${a.channel_id}`
      return {
        name:
          `<span style="color:${dotColor(a.level)}">●</span> ` +
          `${label}` +
          `<span style="color:#8aa3c8;font-size:11px;margin-left:6px">${formatTime(a.started_at, false)}</span>`,
        value: 1,
      }
    }),
    rowNum: 6,
    waitTime: 2000,
    hoverPause: true,
    carousel: 'single' as const,
    valueFormatter: (_item: unknown) => '1',
    unit: '',
    oddRowBGC: 'rgba(10,26,58,0.55)',
    evenRowBGC: 'rgba(16,43,94,0.55)',
  }
})
</script>

<template>
  <el-container class="dashboard">
    <header class="title-bar">
      <el-row align="middle" :gutter="0" class="title-row">
        <el-col :span="8" class="col-left">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="#3de7c9" stroke-width="1.6" stroke-linejoin="round" />
              <path d="M7 12 L12 7 L17 12 L12 17 Z" stroke="#3de7c9" stroke-width="1.4" stroke-linejoin="round"
                opacity="0.55" />
            </svg>
          </div>
        </el-col>
        <el-col :span="8" class="col-center">
          <div class="title-main">{{ platformName }}</div>
        </el-col>
        <el-col :span="8" class="col-right">
          <span class="time-text">{{ timeText }}</span>
          <el-button type="primary" plain class="nav-btn" @click="router.push('/analysis')">
            数据后台
          </el-button>
        </el-col>
      </el-row>
    </header>
    <el-container class="dashboard-main">
      <el-main v-loading="statsLoading" class="scene-area">
        <!-- 顶部四块统计 -->
        <div class="stats-row">
          <BorderBox8 class="stat-box" :color="BORDER_COLOR">
            <div class="stat-title">活跃告警</div>
            <DigitalFlop :config="activeFlopConfig" class="stat-flop" />
          </BorderBox8>
          <BorderBox8 class="stat-box" :color="BORDER_COLOR">
            <div class="stat-title">近 24h 告警</div>
            <DigitalFlop :config="alerts24hFlopConfig" class="stat-flop" />
          </BorderBox8>
          <BorderBox8 class="stat-box" :color="BORDER_COLOR">
            <div class="stat-title">告警分布</div>
            <div class="stat-capsule">
              <div v-for="item in capsuleItems" :key="item.name" class="capsule-row">
                <span class="capsule-label" :style="{ color: item.color }">{{ item.name }}</span>
                <div class="capsule-bar">
                  <div class="capsule-fill" :style="{ width: item.width + '%', background: item.color }" />
                </div>
                <span class="capsule-value">{{ item.value }}</span>
              </div>
            </div>
          </BorderBox8>
          <BorderBox8 class="stat-box stat-box-wide" :color="BORDER_COLOR">
            <div class="stat-title">最新告警</div>
            <ScrollRankingBoard v-if="stats?.recent_alerts?.length" :config="recentAlertsConfig" class="stat-ranking" />
            <div v-else class="stat-empty">暂无告警</div>
          </BorderBox8>
        </div>

        <!-- 中央：左侧栏 + [3D + 实时曲线] + 右侧通道面板 -->
        <div class="center-row">
          <BorderBox8 class="sidebar-box" :color="BORDER_COLOR">
            <SensorSidebar />
          </BorderBox8>
          <div class="middle-column">
            <BorderBox8 class="scene-box" :color="BORDER_COLOR">
              <div class="scene-head">
                <span class="scene-title">三维数字孪生</span>
                <span class="scene-tag">在线实时数据 · Powered by ZhiweiSHM</span>
              </div>
              <Scene3D :model-id="dashboardStore.currentModel?.id ?? null" class="scene-canvas" />
            </BorderBox8>
            <BorderBox8 class="chart-box" :color="BORDER_COLOR">
              <ChartStrip />
            </BorderBox8>
          </div>
          <BorderBox8 class="panel-box" :color="BORDER_COLOR">
            <PointPanel />
          </BorderBox8>
        </div>
      </el-main>
    </el-container>
    <AppFooter />
  </el-container>
</template>

<style scoped lang="scss">
.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.title-bar {
  flex-shrink: 0;
  padding-left: 16px;
  padding-right: 16px;
  height: 56px;
  background: linear-gradient(180deg, #0a1a3a 0%, #102b5e 100%);
  border-bottom: 1px solid rgba(61, 231, 201, 0.18);
}

.title-row,
.title-row .el-col {
  height: 100%;
}

.col-left,
.col-center,
.col-right {
  display: flex;
  align-items: center;
  height: 100%;
}
.col-left { justify-content: flex-start; }
.col-center { justify-content: center; }
.col-right { justify-content: flex-end; gap: 16px; }

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(61, 231, 201, 0.18) 0%, rgba(35, 95, 167, 0.18) 100%);
  border: 1px solid rgba(61, 231, 201, 0.35);
}

.title-main {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #d8e3ff;
}

.title-sub {
  font-size: 11px;
  color: #8aa3c8;
  margin-top: 2px;
  letter-spacing: 1px;
}

.time-text {
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 13px;
  color: #d8e3ff;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.dashboard-main {
  flex: 1;
  min-height: 0;
}

.scene-area {
  padding: 8px 14px 6px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: linear-gradient(180deg, #0a1a3a 0%, #102b5e 100%);
  color: #d8e3ff;
}

/* ===== 顶部四块统计 ===== */
.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1.4fr;
  gap: 12px;
  flex-shrink: 0;
}

.stat-box {
  position: relative;
  height: 140px;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;

  :deep(svg) {
    pointer-events: none;
  }

  :deep(.border-box-content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}

.stat-title {
  font-size: 13px;
  letter-spacing: 2px;
  color: #8aa3c8;
  margin-bottom: 8px;
  flex-shrink: 0;
}

/* 关键：min-height:0 让 DigitalFlop 内部 canvas 随容器收缩到 ~86px；
   overflow:hidden 兜底裁剪任何残余溢出 */
.stat-flop {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-capsule {
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.capsule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.capsule-label {
  flex: 0 0 28px;
  font-weight: 600;
}

.capsule-bar {
  flex: 1 1 0;
  min-width: 0;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.capsule-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.capsule-value {
  flex: 0 0 28px;
  text-align: right;
  color: #d8e3ff;
  font-variant-numeric: tabular-nums;
}

.stat-ranking {
  flex: 1;
  min-height: 0;
  margin-top: 2px;
  overflow: hidden;
}

.stat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8aa3c8;
  font-size: 12px;
}

/* ===== 中央：左侧栏 + 3D + 右侧面板 ===== */
.center-row {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.sidebar-box {
  flex: 0 0 240px;
  position: relative;
  padding: 12px 14px;
  min-height: 0;
  overflow: hidden;

  :deep(svg) {
    pointer-events: none;
  }

  :deep(.border-box-content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}

.scene-box {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px 18px;

  /* DataV 的边框 SVG 是绝对定位覆盖层，必须不挡鼠标 */
  :deep(svg) {
    pointer-events: none;
  }

  /* DataV BorderBox1 把 slot 包了一层 .border-box-content，
     需要让该层成为 flex 列容器，Scene3D 才能拿到高度 */
  :deep(.border-box-content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}

.scene-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-shrink: 0;
  margin-bottom: 6px;
}

.scene-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
}

.scene-tag {
  font-size: 11px;
  color: #8aa3c8;
}

.scene-canvas {
  flex: 1;
  min-height: 0;
}

.panel-box {
  flex: 0 0 360px;
  position: relative;
  padding: 12px 16px;
  min-height: 0;
  overflow: hidden;

  :deep(svg) {
    pointer-events: none;
  }

  :deep(.border-box-content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}

/* ===== 中央三列：左侧栏 + [3D + 实时曲线] + 右侧面板 ===== */
.middle-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 曲线移到中间列内：固定高度 + flex 收缩 */
.chart-box {
  flex: 0 0 240px;
  min-height: 0;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(svg) {
    pointer-events: none;
  }

  :deep(.border-box-content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}
</style>