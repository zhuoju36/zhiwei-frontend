<script setup lang="ts">
/**
 * 通用分析摘要渲染器：任意 JSON result_summary 按值类型渲染。
 * 不依赖字段名，保留键序；嵌套对象递归渲染。
 */
import { computed } from 'vue'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  summary: Record<string, unknown> | null | undefined
}>()

/** 键值对列表（保留 Object.entries 顺序） */
const entries = computed<[string, unknown][]>(() =>
  props.summary ? Object.entries(props.summary) : [],
)

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every((item) => isPlainObject(item))
}

/** 对象数组取首元素 key 作为列头 */
function arrayColumns(arr: Record<string, unknown>[]): string[] {
  return Object.keys(arr[0])
}

function displayNumber(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? formatNumber(v) : '-'
}

function cellText(v: unknown): string {
  if (v == null) return '-'
  if (typeof v === 'number') return displayNumber(v)
  return String(v)
}
</script>

<template>
  <el-empty v-if="entries.length === 0" description="暂无摘要" :image-size="60" />
  <div v-else class="summary-renderer">
    <div v-for="[key, value] in entries" :key="key" class="summary-row">
      <div class="row-label">{{ key }}</div>
      <div class="row-value">
        <!-- 标量 -->
        <span v-if="typeof value === 'number' && Number.isFinite(value)" class="num">
          {{ formatNumber(value) }}
        </span>
        <el-tag
          v-else-if="typeof value === 'boolean'"
          :type="value ? 'success' : 'info'"
          size="small"
        >
          {{ value ? 'true' : 'false' }}
        </el-tag>
        <span v-else-if="value === null || value === undefined">-</span>
        <span v-else-if="typeof value === 'string'">{{ value }}</span>

        <!-- 对象数组 → 表格 -->
        <el-table
          v-else-if="isObjectArray(value)"
          :data="value"
          border
          size="small"
          class="nested-table"
        >
          <el-table-column
            v-for="col in arrayColumns(value)"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
          >
            <template #default="{ row }">
              {{ typeof row[col] === 'number' ? displayNumber(row[col]) : cellText(row[col]) }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 基本类型数组 → 标签列表 -->
        <template v-else-if="Array.isArray(value)">
          <el-tag
            v-for="(item, i) in value"
            :key="i"
            size="small"
            class="array-tag"
          >
            {{ cellText(item) }}
          </el-tag>
        </template>

        <!-- 嵌套对象 → 折叠渲染 -->
        <el-collapse v-else-if="isPlainObject(value)" class="nested-collapse">
          <el-collapse-item :title="`对象（${Object.keys(value).length} 个字段）`">
            <SummaryRenderer :summary="value" />
          </el-collapse-item>
        </el-collapse>

        <span v-else>{{ cellText(value) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.summary-renderer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.row-label {
  flex: 0 0 160px;
  color: #909399;
  font-size: 13px;
  line-height: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 24px;
  word-break: break-all;
}

.num {
  font-variant-numeric: tabular-nums;
}

.nested-table {
  width: 100%;
}

.array-tag {
  margin-right: 6px;
}

.nested-collapse {
  border: none;
}
</style>
