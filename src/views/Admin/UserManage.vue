<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { createUser, deleteUser, listUsers, resetPassword, updateUser } from '@/api/user'
import { formatTime } from '@/utils/format'
import type { UserOut, UserRole } from '@/types'

const loading = ref(false)
const rows = ref<UserOut[]>([])
const total = ref(0)
const page = ref(1)
const size = 20

// 用户编辑（创建 / 修改）
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  username: '',
  email: '',
  password: '',
  role: 'user' as UserRole,
  is_active: true,
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [{ required: true, message: '请输入密码（至少 8 位）', trigger: 'blur' }],
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await listUsers({ page: page.value, size })
    rows.value = res.items
    total.value = res.total
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, { username: '', email: '', password: '', role: 'user', is_active: true })
  dialogVisible.value = true
}

function openEdit(row: UserOut): void {
  editingId.value = row.id
  Object.assign(form, { username: row.username, email: row.email, password: '', role: row.role, is_active: row.is_active })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    if (editingId.value == null) {
      await createUser({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
      })
      ElMessage.success('用户已创建')
    } else {
      await updateUser(editingId.value, {
        email: form.email,
        role: form.role,
        is_active: form.is_active,
      })
      ElMessage.success('用户已更新')
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

async function remove(row: UserOut): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteUser(row.id)
    ElMessage.success('用户已删除')
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理（409 LAST_ADMIN / SELF_PROTECTED）
  }
}

// 重置密码
const pwdVisible = ref(false)
const pwdUser = ref<UserOut | null>(null)
const pwdForm = reactive({ new_password: '' })
const pwdSubmitting = ref(false)

function openResetPwd(row: UserOut): void {
  pwdUser.value = row
  pwdForm.new_password = ''
  pwdVisible.value = true
}

async function submitResetPwd(): Promise<void> {
  if (pwdUser.value == null || pwdForm.new_password.length < 8) {
    ElMessage.warning('新密码至少 8 位')
    return
  }
  pwdSubmitting.value = true
  try {
    await resetPassword(pwdUser.value.id, pwdForm.new_password)
    ElMessage.success('密码已重置')
    pwdVisible.value = false
  } catch {
    // 错误提示由请求拦截器统一处理（422 WEAK_PASSWORD）
  } finally {
    pwdSubmitting.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="user-page">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新建用户</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="200" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text @click="openResetPwd(row)">重置密码</el-button>
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

    <!-- 创建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId == null ? '新建用户' : '编辑用户'" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" maxlength="64" placeholder="3-64 位字母/数字/._- " />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="user@example.com" />
        </el-form-item>
        <el-form-item v-if="editingId == null" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" class="full-width">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editingId != null" label="状态">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="pwdVisible" :title="`重置密码 - ${pwdUser?.username ?? ''}`" width="420px">
      <el-form label-width="80px">
        <el-form-item label="新密码">
          <el-input
            v-model="pwdForm.new_password"
            type="password"
            show-password
            placeholder="至少 8 位，需满足平台密码策略"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="submitResetPwd">重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.user-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  background: #fff;
  padding: 12px;
  border-radius: 4px;
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
