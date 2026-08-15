<script setup lang="ts">
import { computed } from 'vue'
import ScrollBoard from '@kjgl77/datav-vue3'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { formatValue } from '@/utils/format'
import type { Quality } from '@/types'

const dashboardStore = useDashboardStore()
const wsStore = useWebSocketStore()

/**
 * ScrollBoard 是单色文本滚动行，会丢失原 el-tag 的状态色。
 * 这里把 quality（good/uncertain/bad）映射到中文短文本作为有意识的取舍。
 */
const QUALITY_LABEL: Record<Quality, string> = {
  good: '良好',
  uncertain: '不确定',
  bad: '异常',
}
const NO_DATA_LABEL = '暂无数据'

interface BoardRow {
  channelId: number
  cells: string[]
}

function qualityLabel(quality: Quality | undefined | null): string {
  if (quality == null) return NO_DATA_LABEL
  return QUALITY_LABEL[quality] ?? NO_DATA_LABEL
}

function padIndex(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * 通道列表（项目内已知）+ WS 兜底发现的 channel_id（列表外）
 * 一并按 channel_id 升序拼装，保证 ScrollBoard 不打乱顺序。
 */
const rows = computed<BoardRow[]>(() => {
  const list: BoardRow[] = []
  dashboardStore.channels.forEach((c, idx) => {
    const rt = wsStore.latestData[c.id]
    list.push({
      channelId: c.id,
      cells: [
        padIndex(idx + 1),
        c.channel_code,
        rt ? formatValue(rt.value, null, 2) : '-',
        rt?.unit ?? c.unit ?? '',
        `[${qualityLabel(rt?.quality)}]`,
      ],
    })
  })
  wsStore.knownChannelIds
    .filter((id) => !dashboardStore.channelMap.has(id))
    .forEach((id) => {
      const rt = wsStore.latestData[id]
      if (!rt) return
      list.push({
        channelId: id,
        cells: [
          padIndex(list.length + 1),
          `${rt.device_code}/${rt.channel_code}`,
          formatValue(rt.value, null, 2),
          rt.unit ?? '',
          `[${qualityLabel(rt.quality)}]`,
        ],
      })
    })
  // 保持稳定：按 channelId 升序展示（与原 PointPanel 一致）
  list.sort((a, b) => a.channelId - b.channelId)
  return list
})

const totalCount = computed(() => rows.value.length)

/** 通道行点击：选中通道并触发大屏底部曲线联动 */
function onClick(event: { row: string[]; rowIndex: number }): void {
  const row = rows.value[event.rowIndex]
  if (row) dashboardStore.selectChannel(row.channelId)
}

const boardConfig = computed(() => ({
  header: ['序号', '通道', '最新值', '单位', '质量'],
  data: rows.value.map((r) => r.cells),
  rowNum: 10,
  headerHeight: 32,
  rowHeight: 32,
  waitTime: 2000,
  hoverPause: true,
  index: false,
  carousel: 'single' as const,
  columnWidth: [50, 110, 80, 70, 80],
  align: ['center', 'left', 'right', 'left', 'center'],
  headerBGC: 'rgba(16,43,94,0.6)',
  oddRowBGC: 'rgba(10,26,58,0.55)',
  evenRowBGC: 'rgba(16,43,94,0.55)',
}))
</script>

<template>
  <div v-loading="dashboardStore.channelsLoading" class="point-panel">
    <div class="panel-head">
      <span class="panel-title">测点实时通道（{{ totalCount }}）</span>
      <span class="quality-hint">质量映射：good 良好 / uncertain 不确定 / bad 异常</span>
    </div>
    <div v-if="totalCount === 0" class="panel-empty">暂无通道</div>
    <ScrollBoard
      v-else
      :config="boardConfig"
      class="panel-board"
      @click="onClick"
    />
  </div>
</template>

<style scoped lang="scss">
.point-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #d8e3ff;
}

.panel-head {
  padding: 8px 4px 6px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.18);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
}

.quality-hint {
  font-size: 11px;
  color: #8aa3c8;
}

.panel-empty {
  margin-top: 16px;
  text-align: center;
  color: #8aa3c8;
  font-size: 12px;
}

.panel-board {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
}
</style>