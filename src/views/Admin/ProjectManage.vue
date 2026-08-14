<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  assignUser,
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  type ProjectPermission,
} from '@/api/project'
import { listUsers } from '@/api/user'
import { formatTime } from '@/utils/format'
import type { Project, UserOut } from '@/types'

const loading = ref(false)
const rows = ref<Project[]>([])
const total = ref(0)
const page = ref(1)
const size = 20

// 项目编辑
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  name: '',
  description: '',
  hasLocation: false,
  lat: 0,
  lng: 0,
  address: '',
})

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await getProjects(page.value, size)
    rows.value = res.items
    total.value = res.total
  } catch {
    // 错误提示由请求拦截器统一处理
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    name: '',
    description: '',
    hasLocation: false,
    lat: 0,
    lng: 0,
    address: '',
  })
  dialogVisible.value = true
}

function openEdit(row: Project): void {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    description: row.description ?? '',
    hasLocation: row.location != null,
    lat: row.location?.lat ?? 0,
    lng: row.location?.lng ?? 0,
    address: row.location?.address ?? '',
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const payload = {
    name: form.name,
    description: form.description || null,
    location: form.hasLocation
      ? { lat: form.lat, lng: form.lng, address: form.address || null }
      : null,
  }
  try {
    if (editingId.value == null) {
      await createProject(payload)
      ElMessage.success('项目已创建')
    } else {
      await updateProject(editingId.value, payload)
      ElMessage.success('项目已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

async function remove(row: Project): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除项目「${row.name}」？该操作不可恢复。`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteProject(row.id)
    ElMessage.success('项目已删除')
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

// 授权对话框
const assignVisible = ref(false)
const assignProject = ref<Project | null>(null)
const assignForm = reactive({ user_id: undefined as number | undefined, permission: 'read' })
const userOptions = ref<UserOut[]>([])
const assignSubmitting = ref(false)

async function openAssign(row: Project): Promise<void> {
  assignProject.value = row
  assignForm.user_id = undefined
  assignForm.permission = 'read'
  assignVisible.value = true
  try {
    const res = await listUsers({ page: 1, size: 200 })
    userOptions.value = res.items
  } catch {
    userOptions.value = []
  }
}

async function submitAssign(): Promise<void> {
  if (assignProject.value == null || assignForm.user_id == null) {
    ElMessage.warning('请选择用户')
    return
  }
  assignSubmitting.value = true
  try {
    await assignUser(assignProject.value.id, {
      user_id: assignForm.user_id,
      permission: assignForm.permission as ProjectPermission,
    })
    ElMessage.success('授权成功')
    assignVisible.value = false
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    assignSubmitting.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="project-page">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新建项目</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="description" label="描述" min-width="200">
        <template #default="{ row }">{{ row.description || '-' }}</template>
      </el-table-column>
      <el-table-column label="位置" min-width="160">
        <template #default="{ row }">
          <template v-if="row.location">
            ({{ row.location.lat }}, {{ row.location.lng }})
            <div class="sub-text">{{ row.location.address || '-' }}</div>
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openAssign(row)">授权</el-button>
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

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建项目' : '编辑项目'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="128" placeholder="项目名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="位置">
          <el-switch v-model="form.hasLocation" />
        </el-form-item>
        <template v-if="form.hasLocation">
          <el-form-item label="纬度">
            <el-input-number v-model="form.lat" :controls="false" placeholder="lat" />
          </el-form-item>
          <el-form-item label="经度">
            <el-input-number v-model="form.lng" :controls="false" placeholder="lng" />
          </el-form-item>
          <el-form-item label="地址">
            <el-input v-model="form.address" placeholder="可选" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 授权对话框 -->
    <el-dialog v-model="assignVisible" :title="`授权访问 - ${assignProject?.name ?? ''}`" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户">
          <el-select v-model="assignForm.user_id" filterable placeholder="选择用户" class="full-width">
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.username}（${u.email}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权限">
          <el-select v-model="assignForm.permission" class="full-width">
            <el-option label="只读" value="read" />
            <el-option label="读写" value="write" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="assignSubmitting" @click="submitAssign">授权</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.project-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  background: #fff;
  padding: 12px;
  border-radius: 4px;
}

.sub-text {
  font-size: 12px;
  color: #909399;
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
