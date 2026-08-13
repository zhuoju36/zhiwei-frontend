import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { Envelope } from './types'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

// 请求拦截：注入 Token
request.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

// 刷新单例锁：并发的 401 只触发一次 refresh
let refreshing: Promise<boolean> | null = null

function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    const userStore = useUserStore()
    refreshing = userStore.refresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

// 响应拦截：解包信封取 data；401 时刷新 Token 并重试原请求
request.interceptors.response.use(
  // 运行时解包信封返回 data；类型上伪装成 AxiosResponse 以满足 axios 拦截器签名，
  // 各 API 函数通过第二泛型声明真实返回类型
  (response) => (response.data as Envelope<unknown>).data as unknown as AxiosResponse,
  async (err: AxiosError<Envelope<null>>) => {
    const config = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined

    // 登录/刷新接口自身的 401 直接走错误提示，避免登录失败时无刷新令牌还触发跳转刷新页面
    const isAuthRequest = config?.url?.includes('/auth/') ?? false

    if (err.response?.status === 401 && config && !config._retried && !isAuthRequest) {
      config._retried = true
      const ok = await tryRefresh()
      if (ok) {
        const userStore = useUserStore()
        config.headers.Authorization = `Bearer ${userStore.token}`
        return request(config)
      }
      const userStore = useUserStore()
      userStore.logout()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    ElMessage.error(err.response?.data?.message || '网络错误')
    return Promise.reject(err)
  },
)

export default request
