<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { deleteModel, getModelFileBlob, listAllModels, uploadModel } from '@/api/model'
import { formatTime } from '@/utils/format'
import { useDashboardStore } from '@/stores/dashboard'
import type { ModelInfo } from '@/types'

const dashboardStore = useDashboardStore()

const subitemId = ref<number | null>(null)
const models = ref<ModelInfo[]>([])
const loading = ref(false)
const uploading = ref(false)

/** 上传文件输入（手动触发） */
const fileInput = ref<HTMLInputElement>()

let refreshTimer: ReturnType<typeof setInterval> | null = null

const statusMeta: Record<ModelInfo['status'], { text: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { text: '等待转换', type: 'info' },
  processing: { text: '转换中', type: 'warning' },
  success: { text: '转换完成', type: 'success' },
  failed: { text: '转换失败', type: 'danger' },
}

/** 是否还有未终态（转换中）的模型，用于轮询刷新 */
const hasInflight = computed(() => models.value.some((m) => m.status === 'pending' || m.status === 'processing'))

onMounted(async () => {
  if (dashboardStore.subitems.length === 0) {
    await dashboardStore.fetchSubitems()
  }
  if (dashboardStore.subitems.length > 0) {
    subitemId.value = dashboardStore.currentSubitemId ?? dashboardStore.subitems[0].id
  }
})

watch(
  subitemId,
  () => {
    stopPolling()
    void loadModels()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopPolling()
})

function startPolling(): void {
  stopPolling()
  refreshTimer = setInterval(() => void loadModels(), 3000)
}

function stopPolling(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

async function loadModels(): Promise<void> {
  if (subitemId.value == null) {
    models.value = []
    return
  }
  loading.value = true
  try {
    models.value = await listAllModels(subitemId.value)
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    loading.value = false
    // 有转换中的任务则持续轮询，全部终态后停止
    if (hasInflight.value) startPolling()
    else stopPolling()
  }
}

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || subitemId.value == null) return
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['obj', 'stl', 'ply', 'gltf', 'glb'].includes(ext)) {
    ElMessage.warning('仅支持 .obj/.stl/.ply/.gltf/.glb 格式')
    return
  }
  uploading.value = true
  try {
    const res = await uploadModel(subitemId.value, file)
    ElMessage.success(`模型已上传，任务 #${res.model_id} 等待转换`)
    await loadModels()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    uploading.value = false
  }
}

async function onDelete(row: ModelInfo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除模型「${row.original_name}」？源文件与 GLB 产物将一并清理。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteModel(row.id)
    ElMessage.success('已删除')
    await loadModels()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

async function onDownload(row: ModelInfo): Promise<void> {
  try {
    const blob = await getModelFileBlob(row.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.original_name.replace(/\.[^.]+$/, '')}.glb`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('GLB 下载失败（模型可能尚未转换完成）')
  }
}
</script>

<template>
  <div class="model-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline class="filter-form">
        <el-form-item label="子项">
          <el-select v-model="subitemId" class="subitem-select" placeholder="选择子项">
            <el-option
              v-for="s in dashboardStore.subitems"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <input
            ref="fileInput"
            type="file"
            accept=".obj,.stl,.ply,.gltf,.glb"
            style="display: none"
            @change="onFileChange"
          />
          <el-button type="primary" :icon="Plus" :loading="uploading" @click="pickFile">
            上传模型
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="models" border empty-text="该子项暂无模型">
        <el-table-column prop="original_name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="source_format" label="格式" width="90" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusMeta[row.status as ModelInfo['status']]?.type ?? 'info'" size="small">
              {{ statusMeta[row.status as ModelInfo['status']]?.text ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error" label="错误信息" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="error-text">{{ row.error || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.finished_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'success'"
              link
              type="primary"
              size="small"
              @click="onDownload(row)"
            >
              下载 GLB
            </el-button>
            <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.model-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-card {
  .filter-form {
    padding: 4px 0 0;
  }
}

.subitem-select {
  width: 220px;
}

.error-text {
  color: #f56c6c;
}
</style>
