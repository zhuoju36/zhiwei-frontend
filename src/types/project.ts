/** 项目（对应后端 ProjectOut） */
export interface Project {
  id: number
  name: string
  description: string | null
  location: string | null
  model_file_key: string | null
  created_by: number | null
  created_at: string
}
