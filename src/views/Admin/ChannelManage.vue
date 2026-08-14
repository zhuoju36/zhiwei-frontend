<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { createChannel, deleteChannel, listAllChannels, updateChannel } from '@/api/channel'
import { listAllDevices } from '@/api/device'
import { listAllSensors } from '@/api/sensor'
import { listAllProjects } from '@/api/project'
import { formatTime } from '@/utils/format'
import type { AlertRule, Channel, Device, Project, Sensor } from '@/types'

const loading = ref(false)
const rows = ref<Channel[]>([])

const projects = ref<Project[]>([])
const filterProjectId = ref<number | null>(null)
const devices = ref<Device[]>([])
const filterDeviceId = ref<number | null>(null)
const sensors = ref<Sensor[]>([])
const filterSensorId = ref<number | null>(null)

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

async function loadSensors(): Promise<void> {
  filterSensorId.value = null
  const deviceId = filterDeviceId.value
  if (deviceId == null) {
    sensors.value = []
    return
  }
  try {
    sensors.value = await listAllSensors(deviceId)
  } catch {
    sensors.value = []
  }
}

async function load(): Promise<void> {
  const sensorId = filterSensorId.value
  if (sensorId == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = await listAllChannels(sensorId)
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(filterProjectId, () => void loadDevices())
watch(filterDeviceId, () => {
  void loadSensors()
  void load()
})
watch(filterSensorId, () => void load())

const ALERT_RULES_TIP =
  'JSON 数组，如 [{"operator":"gt","threshold":1.5,"level":"warning","message":"超限","suppress_seconds":60}]'

// 通道编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  sensor_id: undefined as number | undefined,
  channel_code: '',
  channel_type: '',
  unit: '',
  sampling_rate: 1,
  axis: '',
  note: '',
  alertRulesText: '',
})

const rules = {
  sensor_id: [{ required: true, message: '请选择所属传感器', trigger: 'change' }],
  channel_code: [{ required: true, message: '请输入通道编码', trigger: 'blur' }],
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    sensor_id: filterSensorId.value ?? undefined,
    channel_code: '',
    channel_type: '',
    unit: '',
    sampling_rate: 1,
    axis: '',
    note: '',
    alertRulesText: '',
  })
  dialogVisible.value = true
}

function openEdit(row: Channel): void {
  editingId.value = row.id
  Object.assign(form, {
    sensor_id: row.sensor_id,
    channel_code: row.channel_code,
    channel_type: row.channel_type ?? '',
    unit: row.unit ?? '',
    sampling_rate: row.sampling_rate,
    axis: row.axis ?? '',
    note: row.note ?? '',
    alertRulesText: row.alert_rules ? JSON.stringify(row.alert_rules, null, 2) : '',
  })
  dialogVisible.value = true
}

/** 校验并解析 alert_rules JSON，非法字段直接报错 */
function parseAlertRules(text: string): AlertRule[] | null {
  if (!text.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    ElMessage.error('告警规则不是合法的 JSON')
    return null
  }
  if (!Array.isArray(parsed)) {
    ElMessage.error('告警规则必须是数组')
    return null
  }
  const operators = ['gt', 'lt', 'ge', 'le', 'eq', 'ne']
  const levels = ['info', 'warning', 'danger']
  for (const item of parsed) {
    const rule = item as Partial<AlertRule>
    if (!rule.operator || !operators.includes(rule.operator)) {
      ElMessage.error(`规则 ${JSON.stringify(item)} 缺少合法 operator（gt/lt/ge/le/eq/ne）`)
      return null
    }
    if (typeof rule.threshold !== 'number') {
      ElMessage.error(`规则 ${JSON.stringify(item)} 缺少数字 threshold`)
      return null
    }
    if (!rule.level || !levels.includes(rule.level)) {
      ElMessage.error(`规则 ${JSON.stringify(item)} 缺少合法 level（info/warning/danger）`)
      return null
    }
    if (rule.suppress_seconds != null && (typeof rule.suppress_seconds !== 'number' || rule.suppress_seconds < 0)) {
      ElMessage.error(`规则 ${JSON.stringify(item)} 的 suppress_seconds 必须 ≥0`)
      return null
    }
  }
  return parsed as AlertRule[]
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const alertRules = parseAlertRules(form.alertRulesText)
  if (alertRules === null && form.alertRulesText.trim() !== '') return
  try {
    if (editingId.value == null) {
      if (form.sensor_id == null) {
        ElMessage.warning('请选择所属传感器')
        return
      }
      await createChannel({
        sensor_id: form.sensor_id,
        channel_code: form.channel_code,
        channel_type: form.channel_type || null,
        unit: form.unit || null,
        sampling_rate: form.sampling_rate,
        axis: form.axis || null,
        note: form.note || null,
        alert_rules: alertRules,
      })
      ElMessage.success('通道已创建')
    } else {
      await updateChannel(editingId.value, {
        channel_type: form.channel_type || null,
        unit: form.unit || null,
        sampling_rate: form.sampling_rate,
        axis: form.axis || null,
        note: form.note || null,
        alert_rules: alertRules ?? undefined,
      })
      ElMessage.success('通道已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

async function remove(row: Channel): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除通道「${row.channel_code}」？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteChannel(row.id)
    ElMessage.success('通道已删除')
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
  <div class="channel-page">
    <div class="toolbar">
      <el-select v-model="filterProjectId" placeholder="选择项目" class="filter-select">
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <el-select v-model="filterDeviceId" placeholder="选择设备" class="filter-select">
        <el-option v-for="d in devices" :key="d.id" :label="d.device_code" :value="d.id" />
      </el-select>
      <el-select v-model="filterSensorId" placeholder="选择传感器" class="filter-select">
        <el-option v-for="s in sensors" :key="s.id" :label="s.sensor_code" :value="s.id" />
      </el-select>
      <el-button type="primary" :disabled="filterSensorId == null" @click="openCreate">
        新建通道
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="channel_code" label="通道编码" min-width="140" />
      <el-table-column prop="channel_type" label="类型" min-width="100">
        <template #default="{ row }">{{ row.channel_type || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit" label="单位" width="90">
        <template #default="{ row }">{{ row.unit || '-' }}</template>
      </el-table-column>
      <el-table-column prop="sampling_rate" label="采样率" width="90" />
      <el-table-column prop="axis" label="轴向" width="80">
        <template #default="{ row }">{{ row.axis || '-' }}</template>
      </el-table-column>
      <el-table-column label="告警规则数" width="110">
        <template #default="{ row }">{{ row.alert_rules?.length ?? 0 }}</template>
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

    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建通道' : '编辑通道'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="所属传感器" prop="sensor_id">
          <el-select v-model="form.sensor_id" placeholder="选择传感器" class="full-width">
            <el-option
              v-for="s in sensors"
              :key="s.id"
              :label="`${s.sensor_code}${s.model ? '（' + s.model + '）' : ''}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="通道编码" prop="channel_code">
          <el-input
            v-model="form.channel_code"
            maxlength="64"
            placeholder="唯一编码"
            :disabled="editingId != null"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="form.channel_type" maxlength="32" placeholder="可选，如 振动/应变" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="form.unit" maxlength="16" placeholder="可选，如 mm/s" />
        </el-form-item>
        <el-form-item label="采样率">
          <el-input-number v-model="form.sampling_rate" :min="1" />
        </el-form-item>
        <el-form-item label="轴向">
          <el-input v-model="form.axis" maxlength="8" placeholder="可选，如 X/Y/Z" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" maxlength="512" placeholder="可选" />
        </el-form-item>
        <el-form-item label="告警规则">
          <el-input
            v-model="form.alertRulesText"
            type="textarea"
            :rows="5"
            :placeholder="ALERT_RULES_TIP"
          />
          <div class="form-tip">{{ ALERT_RULES_TIP }}</div>
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
.channel-page {
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
  flex-wrap: wrap;
}

.filter-select {
  width: 180px;
}

.full-width {
  width: 100%;
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
