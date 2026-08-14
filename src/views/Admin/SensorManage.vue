<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { listAllDevices } from '@/api/device'
import { listAllPoints } from '@/api/point'
import { createSensor, deleteSensor, listAllSensors, updateSensor } from '@/api/sensor'
import { listAllSubitems } from '@/api/subitem'
import { formatTime } from '@/utils/format'
import type { Device, Point, Sensor, Subitem } from '@/types'

const loading = ref(false)
const rows = ref<Sensor[]>([])

const subitems = ref<Subitem[]>([])
const filterSubitemId = ref<number | null>(null)
const devices = ref<Device[]>([])
const filterDeviceId = ref<number | null>(null)
const points = ref<Point[]>([])
const filterPointId = ref<number | null>(null)

async function loadSubitems(): Promise<void> {
  try {
    subitems.value = await listAllSubitems()
  } catch {
    subitems.value = []
  }
}

async function loadDevices(): Promise<void> {
  filterDeviceId.value = null
  const id = filterSubitemId.value
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

async function loadPoints(): Promise<void> {
  filterPointId.value = null
  const deviceId = filterDeviceId.value
  if (deviceId == null) {
    points.value = []
    return
  }
  try {
    points.value = await listAllPoints({ device_id: deviceId })
  } catch {
    points.value = []
  }
}

async function load(): Promise<void> {
  const pointId = filterPointId.value
  if (pointId == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = await listAllSensors(pointId)
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(filterSubitemId, () => {
  void loadDevices()
})
watch(filterDeviceId, () => {
  void loadPoints()
  void load()
})
watch(filterPointId, () => {
  void load()
})

// 传感器编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  point_id: undefined as number | undefined,
  sensor_code: '',
  model: '',
  manufacturer: '',
  install_date: '',
  last_calibration: '',
  metadataText: '',
})

const rules = {
  point_id: [{ required: true, message: '请选择所属测点', trigger: 'change' }],
  sensor_code: [{ required: true, message: '请输入传感器编码', trigger: 'blur' }],
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    point_id: filterPointId.value ?? undefined,
    sensor_code: '',
    model: '',
    manufacturer: '',
    install_date: '',
    last_calibration: '',
    metadataText: '',
  })
  dialogVisible.value = true
}

function openEdit(row: Sensor): void {
  editingId.value = row.id
  Object.assign(form, {
    point_id: row.point_id,
    sensor_code: row.sensor_code,
    model: row.model ?? '',
    manufacturer: row.manufacturer ?? '',
    install_date: row.install_date ?? '',
    last_calibration: row.last_calibration ?? '',
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
      if (form.point_id == null) {
        ElMessage.warning('请选择所属测点')
        return
      }
      await createSensor({
        point_id: form.point_id,
        sensor_code: form.sensor_code,
        model: form.model || null,
        manufacturer: form.manufacturer || null,
        install_date: form.install_date || null,
        last_calibration: form.last_calibration || null,
        metadata: metadata ?? null,
      })
      ElMessage.success('传感器已创建')
    } else {
      await updateSensor(editingId.value, {
        model: form.model || null,
        manufacturer: form.manufacturer || null,
        install_date: form.install_date || null,
        last_calibration: form.last_calibration || null,
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
  await loadSubitems()
  if (subitems.value.length > 0) {
    filterSubitemId.value = subitems.value[0].id
  }
})
</script>

<template>
  <div class="sensor-page">
    <div class="toolbar">
      <el-select v-model="filterSubitemId" placeholder="选择子项" class="filter-select">
        <el-option v-for="s in subitems" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="filterDeviceId" placeholder="选择设备" class="filter-select">
        <el-option v-for="d in devices" :key="d.id" :label="d.device_code" :value="d.id" />
      </el-select>
      <el-select v-model="filterPointId" placeholder="选择测点" class="filter-select">
        <el-option v-for="p in points" :key="p.id" :label="p.point_code" :value="p.id" />
      </el-select>
      <el-button type="primary" :disabled="filterPointId == null" @click="openCreate">
        新建传感器
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="sensor_code" label="传感器编码" min-width="140" />
      <el-table-column prop="model" label="型号" min-width="120">
        <template #default="{ row }">{{ row.model || '-' }}</template>
      </el-table-column>
      <el-table-column prop="manufacturer" label="厂商" min-width="120">
        <template #default="{ row }">{{ row.manufacturer || '-' }}</template>
      </el-table-column>
      <el-table-column label="安装日期" width="120">
        <template #default="{ row }">{{ row.install_date || '-' }}</template>
      </el-table-column>
      <el-table-column label="上次标定" width="120">
        <template #default="{ row }">{{ row.last_calibration || '-' }}</template>
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

    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建传感器' : '编辑传感器'" width="540px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="所属测点" prop="point_id">
          <el-select v-model="form.point_id" placeholder="选择测点" class="full-width">
            <el-option
              v-for="p in points"
              :key="p.id"
              :label="`${p.point_code}${p.point_name ? '（' + p.point_name + '）' : ''}`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="传感器编码" prop="sensor_code">
          <el-input
            v-model="form.sensor_code"
            maxlength="64"
            placeholder="唯一编码"
            :disabled="editingId != null"
          />
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

.full-width {
  width: 100%;
}
</style>
