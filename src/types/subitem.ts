/** 子项位置（可选，{lat, lng, address}） */
export interface SubitemLocation {
  lat: number
  lng: number
  address: string | null
}

/** 子项（对应后端 SubitemOut） */
export interface Subitem {
  id: number
  name: string
  description: string | null
  location: SubitemLocation | null
  created_by: number | null
  created_at: string
}
