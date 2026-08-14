<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { getSetupStatus, initAdmin } from '@/api/setup'
import { getPlatform } from '@/api/platform'
import { useUserStore } from '@/stores/user'
import type { PasswordRequirements } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

/** 平台名称（来自 platform_settings.platform_name，公开接口） */
const platformName = ref('')

/** 系统是否已初始化（未初始化时显示创建管理员向导） */
const initialized = ref(true)
const checking = ref(true)
const passwordReqs = ref<PasswordRequirements | null>(null)

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const setupFormRef = ref<FormInstance>()
const setupLoading = ref(false)
const setupForm = reactive({
  username: '',
  email: '',
  password: '',
  confirm: '',
})

const setupRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9_.-]+$/,
      message: '仅允许字母、数字、_ . -',
      trigger: 'blur',
    },
    { min: 3, max: 64, message: '长度 3-64 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
  confirm: [
    {
      validator: (_rule: unknown, value: string, callback: (err?: Error) => void) => {
        if (value !== setupForm.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

onMounted(async () => {
  try {
    const status = await getSetupStatus()
    initialized.value = status.initialized
    passwordReqs.value = status.password_requirements
  } catch {
    // 初始化状态探测失败时按已初始化处理（后端不可达时提示登录失败）
  } finally {
    checking.value = false
  }

  // 平台名称（公开接口；失败保持默认文案，不阻断登录页）
  try {
    const platform = await getPlatform()
    if (platform.platform_name) platformName.value = platform.platform_name
  } catch {
    /* 静默 */
  }
})

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (err) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      '登录失败，请检查用户名和密码'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

/** 创建首个管理员：成功后直接写入令牌并进入系统 */
async function onSetupSubmit(): Promise<void> {
  const valid = await setupFormRef.value?.validate().catch(() => false)
  if (!valid) return
  setupLoading.value = true
  try {
    const res = await initAdmin({
      username: setupForm.username,
      email: setupForm.email,
      password: setupForm.password,
    })
    userStore.setTokens(res.access_token, res.refresh_token)
    ElMessage.success(`初始化完成，欢迎 ${res.username}`)
    router.push('/')
  } catch (err) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      '初始化失败'
    ElMessage.error(message)
  } finally {
    setupLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card v-if="!checking && !initialized" class="login-card setup-card">
      <h2 class="login-title">初始化系统</h2>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="setup-alert"
        :title="passwordReqs?.description || '创建系统首个管理员账号'"
      />
      <el-form
        ref="setupFormRef"
        :model="setupForm"
        :rules="setupRules"
        size="large"
        @keyup.enter="onSetupSubmit"
      >
        <el-form-item prop="username">
          <el-input v-model="setupForm.username" placeholder="管理员用户名" autofocus />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="setupForm.email" placeholder="邮箱" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="setupForm.password"
            type="password"
            placeholder="密码（至少 8 位，含字母与数字）"
            show-password
          />
        </el-form-item>
        <el-form-item prop="confirm">
          <el-input v-model="setupForm.confirm" type="password" placeholder="确认密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button class="login-button" type="primary" :loading="setupLoading" @click="onSetupSubmit">
            创建管理员
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-else class="login-card">
      <h2 class="login-title">{{ platformName || '结构健康监测平台' }}</h2>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="onSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" autofocus />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button class="login-button" type="primary" :loading="loading" @click="onSubmit">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
}

.login-card {
  width: 380px;
}

.setup-card {
  width: 420px;
}

.login-title {
  margin: 0 0 24px;
  text-align: center;
  font-size: 20px;
}

.setup-alert {
  margin-bottom: 16px;
}

.login-button {
  width: 100%;
}
</style>
