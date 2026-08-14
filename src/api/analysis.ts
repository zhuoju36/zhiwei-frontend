import axios from 'axios'
import request from './request'
import { useUserStore } from '@/stores/user'
import type { PageData } from './types'
import type { AnalysisJob, AnalysisPluginMeta, AnalysisSubmitOut, JobStatus } from '@/types'

export interface AnalysisJobCreatePayload {
  channel_id: number
  plugin: string
  params?: Record<string, unknown>
}

/** 列出已注册的分析插件（公开接口，无需登录也可调用） */
export function listPlugins(): Promise<AnalysisPluginMeta[]> {
  return request.get<unknown, AnalysisPluginMeta[]>('/analysis/plugins')
}

export function createJob(payload: AnalysisJobCreatePayload): Promise<AnalysisSubmitOut> {
  return request.post<unknown, AnalysisSubmitOut>('/analysis/jobs', payload)
}

export function listJobs(params: {
  channel_id?: number
  plugin?: string
  status?: JobStatus
  page?: number
  size?: number
}): Promise<PageData<AnalysisJob>> {
  return request.get<unknown, PageData<AnalysisJob>>('/analysis/jobs', { params })
}

export function getJob(id: number): Promise<AnalysisJob> {
  return request.get<unknown, AnalysisJob>(`/analysis/jobs/${id}`)
}

/**
 * 下载分析结果附件（application/octet-stream，非信封，需 JWT）。
 * 不走 request 实例（避免信封解包拦截器），独立 axios 以 blob 接收。
 * 任务未完成时后端 409 ANALYSIS_RESULT_NOT_READY。
 * 返回 blob 与 Content-Disposition 中的文件名（可能为 null）。
 */
export interface ArtifactFile {
  blob: Blob
  filename: string | null
}

export async function getResultBlob(jobId: number): Promise<ArtifactFile> {
  const token = useUserStore().token
  const res = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL}/analysis/jobs/${jobId}/result`,
    {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  )
  const disposition = String(res.headers['content-disposition'] ?? '')
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return { blob: res.data as Blob, filename: match?.[1] ?? null }
}
