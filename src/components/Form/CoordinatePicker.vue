<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { PointPosition } from '@/types'

interface Props {
  /** 三维坐标；父组件打开对话框时应传入全新对象（null 时保持当前草稿不覆盖） */
  modelValue: PointPosition | null
}
const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: PointPosition]
}>()

// 本地草稿编辑，任一坐标变化即回传
const draft = reactive({ x: 0, y: 0, z: 0 })

watch(
  () => props.modelValue,
  (v) => {
    if (v == null) return
    draft.x = v.x
    draft.y = v.y
    draft.z = v.z
  },
  { immediate: true },
)

watch(draft, () => {
  emit('update:modelValue', { x: draft.x, y: draft.y, z: draft.z })
})
</script>

<template>
  <div class="coordinate-picker">
    <div class="coord-field">
      <span class="coord-label">X</span>
      <el-input-number v-model="draft.x" :controls="false" size="small" />
    </div>
    <div class="coord-field">
      <span class="coord-label">Y</span>
      <el-input-number v-model="draft.y" :controls="false" size="small" />
    </div>
    <div class="coord-field">
      <span class="coord-label">Z</span>
      <el-input-number v-model="draft.z" :controls="false" size="small" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.coordinate-picker {
  display: flex;
  gap: 8px;
}

.coord-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.coord-label {
  font-size: 12px;
  color: #606266;
  width: 14px;
}
</style>
