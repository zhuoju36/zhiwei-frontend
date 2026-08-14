import axios from 'axios'
import type { Envelope } from './types'
import type { InitAdminResponse, SetupStatus } from '@/types'

const baseURL: string = import.meta.env.VITE_API_BASE_URL

/** 初始化状态与密码策略（公开接口） */
export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await axios.get<Envelope<SetupStatus>>(`${baseURL}/setup/status`)
  return res.data.data
}

/** 创建首个 admin 用户（公开接口；仅 users 表为空时可用，否则 409 ALREADY_INITIALIZED）→201 */
export async function initAdmin(payload: {
  username: string
  email: string
  password: string
}): Promise<InitAdminResponse> {
  const res = await axios.post<Envelope<InitAdminResponse>>(`${baseURL}/setup/init-admin`, payload)
  return res.data.data
}
