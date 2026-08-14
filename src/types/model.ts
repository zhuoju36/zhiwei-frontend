/** 3D 模型处理状态 */
export type ModelStatus = 'pending' | 'processing' | 'success' | 'failed'

/** 3D 模型（对应后端 ModelOut） */
export interface ModelInfo {
  id: number
  project_id: number
  original_name: string
  source_format: string
  glb_key: string | null
  status: ModelStatus
  error: string | null
  note: string | null
  created_at: string
  finished_at: string | null
}
