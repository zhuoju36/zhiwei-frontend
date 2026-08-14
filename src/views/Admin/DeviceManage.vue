<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  createDevice,
  deleteDevice,
  listAllDevices,
  listDevices,
  updateDevice,
} from '@/api/device'
import { listAllProjects } from '@/api/project'
import { listProtocols } from '@/api/protocol'
import { formatTime } from '@/utils/format'
import type { Device, Project, ProtocolInfo } from '@/types'

const loading = ref(false)
const rows = ref<Device[]>([])
const total = ref(0)
const page = ref(1)
const size = 20

const projects = ref<Project[]>([])
const filterProjectId = ref<number | null>(null)
const protocols = ref<ProtocolInfo[]>([])
const protocolNames = computed(() => protocols.value.map((p) => p.name))

async function loadProjects(): Promise<void> {
  try {
    projects.value = await listAllProjects()
  } catch {
    projects.value = []
  }
}

async function load(): Promise<void> {
  const projectId = filterProjectId.value
  if (projectId == null) {
    rows.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await listDevices({ project_id: projectId, page: page.value, size })
    rows.value = res.items
    total.value = res.total
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

// 设备编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  project_id: undefined as number | undefined,
  device_code: '',
  device_name: '',
  protocol: '',
  note: '',
  configText: '{}',
})

const rules = {
  project_id: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  device_code: [{ required: true, message: '请输入设备编码', trigger: 'blur' }],
  protocol: [{ required: true, message: '请选择协议', trigger: 'change' }],
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    project_id: filterProjectId.value ?? undefined,
    device_code: '',
    device_name: '',
    protocol: protocolNames.value[0] ?? '',
    note: '',
    configText: '{}',
  })
  dialogVisible.value = true
}

function openEdit(row: Device): void {
  editingId.value = row.id
  Object.assign(form, {
    project_id: row.project_id,
    device_code: row.device_code,
    device_name: row.device_name ?? '',
    protocol: row.protocol,
    note: row.note ?? '',
    configText: row.config ? JSON.stringify(row.config, null, 2) : '{}',
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  let config: Record<string, unknown> | undefined
  try {
    config = form.configText.trim() ? JSON.parse(form.configText) : {}
  } catch {
    ElMessage.error('config 不是合法的 JSON')
    return
  }
  try {
    if (editingId.value == null) {
      if (form.project_id == null) {
        ElMessage.warning('请选择所属项目')
        return
      }
      await createDevice({
        project_id: form.project_id,
        device_code: form.device_code,
        device_name: form.device_name || null,
        protocol: form.protocol,
        note: form.note || null,
        config,
      })
      ElMessage.success('设备已创建')
    } else {
      await updateDevice(editingId.value, {
        device_name: form.device_name || null,
        protocol: form.protocol,
        note: form.note || null,
        config,
      })
      ElMessage.success('设备已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理（409 DEVICE_CODE_EXISTS / 422 PROTOCOL_NOT_REGISTERED）
  }
}

async function remove(row: Device): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除设备「${row.device_code}」？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteDevice(row.id)
    ElMessage.success('设备已删除')
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

onMounted(async () => {
  await loadProjects()
  try {
    protocols.value = await listProtocols()
  } catch {
    protocols.value = []
  }
  if (projects.value.length > 0) {
    filterProjectId.value = projects.value[0].id
  }
})
</script>

<template>
  <div class="device-page">
    <div class="toolbar">
      <el-select
        v-model="filterProjectId"
        placeholder="选择项目"
        class="filter-select"
        @change="() => { page = 1; void load() }"
      >
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <el-button type="primary" :disabled="filterProjectId == null" @click="openCreate">
        新建设备
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="device_code" label="设备编码" min-width="140" />
      <el-table-column prop="device_name" label="名称" min-width="140">
        <template #default="{ row }">{{ row.device_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="protocol" label="协议" width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'online' ? 'success' : row.status === 'error' ? 'danger' : 'info'"
            size="small"
          >
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近在线" width="170">
        <template #default="{ row }">{{ formatTime(row.last_seen) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text @click="openEdit(row)">编辑</el-button>
          <el-button size="small" text type="danger" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建设备' : '编辑设备'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="所属项目" prop="project_id">
          <el-select v-model="form.project_id" placeholder="选择项目" class="full-width">
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备编码" prop="device_code">
          <el-input
            v-model="form.device_code"
            maxlength="64"
            placeholder="唯一编码"
            :disabled="editingId != null"
          />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.device_name" maxlength="128" placeholder="可选" />
        </el-form-item>
        <el-form-item label="协议" prop="protocol">
          <el-select v-model="form.protocol" placeholder="选择协议" class="full-width">
            <el-option v-for="name in protocolNames" :key="name" :label="name" :value="name" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" maxlength="512" placeholder="可选" />
        </el-form-item>
        <el-form-item label="config">
          <el-input v-model="form.configText" type="textarea" :rows="4" placeholder="{}" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.device-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  background: #fff;
  padding: 12px;
  border-radius: 4px;
  display: flex;
  gap: 12px;
}

.filter-select {
  width: 240px;
}

.pager {
  justify-content: flex-end;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
}

.full-width {
  width: 100%;
}
</style>
