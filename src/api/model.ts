import axios from 'axios'
import request from './request'
import { fetchAllPages } from './pager'
import { useUserStore } from '@/stores/user'
import type { PageData } from './types'
import type { ModelInfo } from '@/types'

export function listModels(params: {
  subitem_id: number
  page?: number
  size?: number
}): Promise<PageData<ModelInfo>> {
  return request.get<unknown, PageData<ModelInfo>>('/models', { params })
}

/** 拉取子项下全部模型 */
export function listAllModels(subitemId: number): Promise<ModelInfo[]> {
  return fetchAllPages((page) => listModels({ subitem_id: subitemId, page }))
}

/** 上传模型（multipart，.obj/.stl/.ply/.gltf/.glb ≤200MB）→201 */
export function uploadModel(subitemId: number, file: File): Promise<{ model_id: number; status: string }> {
  const form = new FormData()
  form.append('file', file)
  return request.post<unknown, { model_id: number; status: string }>(
    `/models/${subitemId}/upload`,
    form,
  )
}

/** 删除模型（仅 admin）→204 */
export function deleteModel(id: number): Promise<void> {
  return request.delete<unknown, void>(`/models/${id}`)
}

/**
 * 下载模型 GLB 流（需 JWT；非信封二进制响应，不走 request 实例，避免信封解包拦截器）。
 * 未就绪时后端 409 MODEL_NOT_READY。
 */
export async function getModelFileBlob(modelId: number): Promise<Blob> {
  const token = useUserStore().token
  const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/models/${modelId}/file`, {
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  return res.data as Blob
}
