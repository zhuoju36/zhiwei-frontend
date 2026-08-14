<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import CoordinatePicker from '@/components/Form/CoordinatePicker.vue'
import { listAllDevices } from '@/api/device'
import { createSensor, deleteSensor, listAllSensors, updateSensor } from '@/api/sensor'
import { listAllProjects } from '@/api/project'
import { formatTime } from '@/utils/format'
import type { Device, Position3D, Project, Sensor } from '@/types'

const loading = ref(false)
const rows = ref<Sensor[]>([])

const projects = ref<Project[]>([])
const filterProjectId = ref<number | null>(null)
const devices = ref<Device[]>([])
const filterDeviceId = ref<number | null>(null)

async function loadProjects(): Promise<void> {
  try {
    projects.value = await listAllProjects()
  } catch {
    projects.value = []
  }
}

async function loadDevices(): Promise<void> {
  filterDeviceId.value = null
  const id = filterProjectId.value
  if (id == null) {
    devices.value = []
    return
  }
  try {
    devices.value = await listAllDevices(id)
  } catch {
    devices.value = []
  }
}

async function load(): Promise<void> {
  const deviceId = filterDeviceId.value
  if (deviceId == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = await listAllSensors(deviceId)
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(filterProjectId, () => void loadDevices())
watch(filterDeviceId, () => void load())

// 传感器编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  device_id: undefined as number | undefined,
  sensor_code: '',
  sensor_name: '',
  sensor_type: '',
  position: { x: 0, y: 0, z: 0 } as Position3D,
  model: '',
  manufacturer: '',
  install_date: '',
  last_calibration: '',
  is_active: true,
  note: '',
  metadataText: '',
})

const rules = {
  sensor_code: [{ required: true, message: '请输入传感器编码', trigger: 'blur' }],
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    device_id: filterDeviceId.value ?? undefined,
    sensor_code: '',
    sensor_name: '',
    sensor_type: '',
    position: { x: 0, y: 0, z: 0 },
    model: '',
    manufacturer: '',
    install_date: '',
    last_calibration: '',
    is_active: true,
    note: '',
    metadataText: '',
  })
  dialogVisible.value = true
}

function openEdit(row: Sensor): void {
  editingId.value = row.id
  Object.assign(form, {
    device_id: row.device_id,
    sensor_code: row.sensor_code,
    sensor_name: row.sensor_name ?? '',
    sensor_type: row.sensor_type ?? '',
    position: row.position ? { ...row.position } : { x: 0, y: 0, z: 0 },
    model: row.model ?? '',
    manufacturer: row.manufacturer ?? '',
    install_date: row.install_date ?? '',
    last_calibration: row.last_calibration ?? '',
    is_active: row.is_active,
    note: row.note ?? '',
    metadataText: row.metadata ? JSON.stringify(row.metadata, null, 2) : '',
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  let metadata: Record<string, unknown> | undefined
  if (form.metadataText.trim()) {
    try {
      metadata = JSON.parse(form.metadataText)
    } catch {
      ElMessage.error('metadata 不是合法的 JSON')
      return
    }
  }
  try {
    if (editingId.value == null) {
      if (form.device_id == null) {
        ElMessage.warning('请选择所属设备')
        return
      }
      await createSensor({
        device_id: form.device_id,
        sensor_code: form.sensor_code,
        sensor_name: form.sensor_name || null,
        sensor_type: form.sensor_type || null,
        position: form.position,
        model: form.model || null,
        manufacturer: form.manufacturer || null,
        install_date: form.install_date || null,
        last_calibration: form.last_calibration || null,
        note: form.note || null,
        metadata: metadata ?? null,
      })
      ElMessage.success('传感器已创建')
    } else {
      await updateSensor(editingId.value, {
        sensor_name: form.sensor_name || null,
        sensor_type: form.sensor_type || null,
        position: form.position,
        model: form.model || null,
        manufacturer: form.manufacturer || null,
        install_date: form.install_date || null,
        last_calibration: form.last_calibration || null,
        is_active: form.is_active,
        note: form.note || null,
        metadata: metadata ?? null,
      })
      ElMessage.success('传感器已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

async function remove(row: Sensor): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除传感器「${row.sensor_code}」？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteSensor(row.id)
    ElMessage.success('传感器已删除')
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

onMounted(async () => {
  await loadProjects()
  if (projects.value.length > 0) {
    filterProjectId.value = projects.value[0].id
  }
})
</script>

<template>
  <div class="sensor-page">
    <div class="toolbar">
      <el-select v-model="filterProjectId" placeholder="选择项目" class="filter-select">
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <el-select v-model="filterDeviceId" placeholder="选择设备" class="filter-select">
        <el-option v-for="d in devices" :key="d.id" :label="d.device_code" :value="d.id" />
      </el-select>
      <el-button type="primary" :disabled="filterDeviceId == null" @click="openCreate">
        新建传感器
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="sensor_code" label="传感器编码" min-width="140" />
      <el-table-column prop="sensor_name" label="名称" min-width="120">
        <template #default="{ row }">{{ row.sensor_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="sensor_type" label="类型" min-width="100">
        <template #default="{ row }">{{ row.sensor_type || '-' }}</template>
      </el-table-column>
      <el-table-column label="位置 (X,Y,Z)" min-width="180">
        <template #default="{ row }">
          <template v-if="row.position">
            {{ row.position.x }}, {{ row.position.y }}, {{ row.position.z }}
          </template>
          <span v-else class="muted">未绑定</span>
        </template>
      </el-table-column>
      <el-table-column prop="model" label="型号" min-width="110">
        <template #default="{ row }">{{ row.model || '-' }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
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

    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建传感器' : '编辑传感器'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="传感器编码" prop="sensor_code">
          <el-input
            v-model="form.sensor_code"
            maxlength="64"
            placeholder="唯一编码"
            :disabled="editingId != null"
          />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.sensor_name" maxlength="128" placeholder="可选，如 塔 3 第 1 测点" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="form.sensor_type" maxlength="64" placeholder="可选，如 structural_joint" />
        </el-form-item>
        <el-form-item label="三维坐标">
          <CoordinatePicker v-model="form.position" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="form.model" maxlength="128" placeholder="可选" />
        </el-form-item>
        <el-form-item label="厂商">
          <el-input v-model="form.manufacturer" maxlength="64" placeholder="可选" />
        </el-form-item>
        <el-form-item label="安装日期">
          <el-date-picker v-model="form.install_date" type="date" value-format="YYYY-MM-DD" class="full-width" />
        </el-form-item>
        <el-form-item label="上次标定">
          <el-date-picker v-model="form.last_calibration" type="date" value-format="YYYY-MM-DD" class="full-width" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" maxlength="512" placeholder="可选" />
        </el-form-item>
        <el-form-item label="metadata">
          <el-input v-model="form.metadataText" type="textarea" :rows="3" placeholder="可选 JSON" />
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
.sensor-page {
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
  width: 200px;
}

.muted {
  color: #909399;
}

.full-width {
  width: 100%;
}
</style>
