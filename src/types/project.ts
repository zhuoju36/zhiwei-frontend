/** 项目位置（可选，{lat, lng, address}） */
export interface ProjectLocation {
  lat: number
  lng: number
  address: string | null
}

/** 项目（对应后端 ProjectOut） */
export interface Project {
  id: number
  name: string
  description: string | null
  location: ProjectLocation | null
  model_file_key: string | null
  created_by: number | null
  created_at: string
}
