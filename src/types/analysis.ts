/** 分析任务状态 */
export type JobStatus = 'pending' | 'running' | 'success' | 'failed'

/** 分析插件元信息（GET /analysis/plugins，前端渲染参数表单用） */
export interface AnalysisPluginMeta {
  name: string
  display_name: string
  description: string
  version: string
  input_channels: number
  min_samples: number
  /** JSON Schema（type: object），params 表单定义 */
  params_schema: Record<string, unknown>
}

/** 频谱峰值（result_summary.top_peaks 内元素） */
export interface PeakInfo {
  freq: number
  magnitude: number
}

/** 分析结果摘要（result_summary） */
export interface ResultSummary {
  dominant_freq: number
  dominant_magnitude: number
  num_samples: number
  sampling_rate: number
  nyquist_freq: number
  freq_resolution: number
  top_peaks: PeakInfo[]
  warnings: string[]
}

/** 分析任务（对应后端 AnalysisJobOut） */
export interface AnalysisJob {
  id: number
  channel_id: number
  plugin: string
  params: Record<string, unknown>
  status: JobStatus
  result_key: string | null
  result_summary: ResultSummary | null
  error: string | null
  submitted_by: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

/** POST /analysis/jobs 响应 data */
export interface AnalysisSubmitOut {
  job_id: number
  status: string
}

/** NPZ 结果解析后的频谱数据 */
export interface SpectrumData {
  frequencies: Float64Array | Float32Array
  magnitudes: Float64Array | Float32Array
  samplingRate: number
}
