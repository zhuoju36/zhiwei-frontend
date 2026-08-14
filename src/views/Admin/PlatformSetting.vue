<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { getPlatform, updatePlatform } from '@/api/platform'
import { formatTime } from '@/utils/format'

const formRef = ref<FormInstance>()
const loading = ref(false)
const saving = ref(false)
const updatedInfo = ref<{ updated_at: string; updated_by: number | null } | null>(null)

const form = reactive({
  platform_name: '',
  contact_email: '',
  description: '',
  logo_url: '',
})

const rules = {
  platform_name: [{ required: true, message: '请输入平台名称', trigger: 'blur' }],
  contact_email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}

onMounted(async () => {
  loading.value = true
  try {
    const p = await getPlatform()
    form.platform_name = p.platform_name
    form.contact_email = p.contact_email ?? ''
    form.description = p.description ?? ''
    form.logo_url = p.logo_url ?? ''
    updatedInfo.value = { updated_at: p.updated_at, updated_by: p.updated_by }
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    loading.value = false
  }
})

async function onSave(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const payload: Record<string, string> = { platform_name: form.platform_name }
    if (form.contact_email.trim()) payload.contact_email = form.contact_email.trim()
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.logo_url.trim()) payload.logo_url = form.logo_url.trim()
    const updated = await updatePlatform(payload)
    updatedInfo.value = { updated_at: updated.updated_at, updated_by: updated.updated_by }
    ElMessage.success('平台信息已更新')
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-card v-loading="loading" shadow="never" class="platform-card">
    <template #header>
      <div class="head">
        <span>平台设置</span>
        <span v-if="updatedInfo" class="updated">
          上次更新：{{ formatTime(updatedInfo.updated_at) }}（用户 #{{ updatedInfo.updated_by ?? '-' }}）
        </span>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="platform-form">
      <el-form-item label="平台名称" prop="platform_name">
        <el-input v-model="form.platform_name" placeholder="平台名称（1-128 字符）" maxlength="128" />
      </el-form-item>
      <el-form-item label="联系邮箱" prop="contact_email">
        <el-input v-model="form.contact_email" placeholder="联系邮箱" maxlength="128" />
      </el-form-item>
      <el-form-item label="平台描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="平台描述" />
      </el-form-item>
      <el-form-item label="Logo URL" prop="logo_url">
        <el-input v-model="form.logo_url" placeholder="https://...（512 字符内）" maxlength="512" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.platform-card {
  max-width: 640px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.updated {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
</style>
