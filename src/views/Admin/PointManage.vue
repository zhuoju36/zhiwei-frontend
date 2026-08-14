<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import CoordinatePicker from '@/components/Form/CoordinatePicker.vue'
import { listAllDevices } from '@/api/device'
import { createPoint, deletePoint, listAllPoints, updatePoint } from '@/api/point'
import { listAllSubitems } from '@/api/subitem'
import { formatTime } from '@/utils/format'
import type { Device, Point, PointPosition, Subitem } from '@/types'

const loading = ref(false)
const rows = ref<Point[]>([])

const subitems = ref<Subitem[]>([])
const filterSubitemId = ref<number | null>(null)
const devices = ref<Device[]>([])
const filterDeviceId = ref<number | null>(null)

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

async function load(): Promise<void> {
  const subitemId = filterSubitemId.value
  if (subitemId == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = await listAllPoints(
      filterDeviceId.value != null
        ? { device_id: filterDeviceId.value }
        : { subitem_id: subitemId },
    )
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(filterSubitemId, () => {
  void loadDevices()
  void load()
})

// 测点编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  device_id: undefined as number | undefined,
  point_code: '',
  point_name: '',
  point_type: '',
  position: null as PointPosition | null,
})

const rules = {
  device_id: [{ required: true, message: '请选择所属设备', trigger: 'change' }],
  point_code: [{ required: true, message: '请输入测点编码', trigger: 'blur' }],
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    device_id: filterDeviceId.value ?? undefined,
    point_code: '',
    point_name: '',
    point_type: '',
    position: { x: 0, y: 0, z: 0 },
  })
  dialogVisible.value = true
}

function openEdit(row: Point): void {
  editingId.value = row.id
  Object.assign(form, {
    device_id: row.device_id,
    point_code: row.point_code,
    point_name: row.point_name ?? '',
    point_type: row.point_type ?? '',
    position: row.position ? { ...row.position } : { x: 0, y: 0, z: 0 },
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    if (editingId.value == null) {
      if (form.device_id == null) {
        ElMessage.warning('请选择所属设备')
        return
      }
      await createPoint({
        device_id: form.device_id,
        point_code: form.point_code,
        point_name: form.point_name || null,
        point_type: form.point_type || null,
        position: form.position,
      })
      ElMessage.success('测点已创建')
    } else {
      await updatePoint(editingId.value, {
        point_name: form.point_name || null,
        point_type: form.point_type || null,
        position: form.position ?? undefined,
      })
      ElMessage.success('测点已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理（409 POINT_CODE_EXISTS）
  }
}

async function remove(row: Point): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除测点「${row.point_code}」？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deletePoint(row.id)
    ElMessage.success('测点已删除')
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
  <div class="point-page">
    <div class="toolbar">
      <el-select v-model="filterSubitemId" placeholder="选择子项" class="filter-select">
        <el-option v-for="s in subitems" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select
        v-model="filterDeviceId"
        placeholder="全部设备"
        clearable
        class="filter-select"
        @change="load"
      >
        <el-option v-for="d in devices" :key="d.id" :label="d.device_code" :value="d.id" />
      </el-select>
      <el-button type="primary" :disabled="filterSubitemId == null" @click="openCreate">
        新建测点
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="point_code" label="测点编码" min-width="140" />
      <el-table-column prop="point_name" label="名称" min-width="140">
        <template #default="{ row }">{{ row.point_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="point_type" label="类型" min-width="100">
        <template #default="{ row }">{{ row.point_type || '-' }}</template>
      </el-table-column>
      <el-table-column label="位置 (X,Y,Z)" min-width="200">
        <template #default="{ row }">
          <template v-if="row.position">
            {{ row.position.x }}, {{ row.position.y }}, {{ row.position.z }}
          </template>
          <span v-else class="muted">未绑定</span>
        </template>
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

    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建测点' : '编辑测点'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="所属设备" prop="device_id">
          <el-select v-model="form.device_id" placeholder="选择设备" class="full-width">
            <el-option
              v-for="d in devices"
              :key="d.id"
              :label="`${d.device_code}${d.device_name ? '（' + d.device_name + '）' : ''}`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="测点编码" prop="point_code">
          <el-input
            v-model="form.point_code"
            maxlength="64"
            placeholder="唯一编码"
            :disabled="editingId != null"
          />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.point_name" maxlength="128" placeholder="可选" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="form.point_type" maxlength="32" placeholder="可选，如 应变计安装位" />
        </el-form-item>
        <el-form-item label="三维坐标">
          <CoordinatePicker v-model="form.position" />
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
.point-page {
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
  width: 220px;
}

.muted {
  color: #909399;
}

.full-width {
  width: 100%;
}
</style>
