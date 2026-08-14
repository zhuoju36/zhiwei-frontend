/** 分析任务状态 */
export type JobStatus = 'pending' | 'running' | 'success' | 'failed'

/** 分析插件元信息（GET /analysis/plugins，前端渲染参数表单与结果视图用） */
export interface AnalysisPluginMeta {
  name: string
  display_name: string
  description: string
  version: string
  input_channels: number
  min_samples: number
  /** JSON Schema（type: object），params 表单定义 */
  params_schema: Record<string, unknown>
  /**
   * 结果展示视图名：fft / generic / 其它（后端 v0.8d 起提供）。
   * 缺失时前端按插件名兜底（fft → fft，其余 → generic）。
   */
  result_view?: string
}

/** 频谱峰值（FFT 摘要 top_peaks 内元素） */
export interface PeakInfo {
  freq: number
  magnitude: number
}

/**
 * FFT 专用摘要（result_summary 的 FFT 形态）。
 * 使用 isFftSummary 类型守卫判断后再读取字段。
 */
export interface FftSummary extends Record<string, unknown> {
  dominant_freq: number
  dominant_magnitude: number
  num_samples: number
  sampling_rate: number
  nyquist_freq: number
  freq_resolution: number
  top_peaks: PeakInfo[]
  warnings?: string[]
}

/** 判断 result_summary 是否为 FFT 形态 */
export function isFftSummary(value: unknown): value is FftSummary {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.dominant_freq === 'number' &&
    typeof s.dominant_magnitude === 'number' &&
    typeof s.sampling_rate === 'number' &&
    Array.isArray(s.top_peaks)
  )
}

/** 通用分析摘要：任意 JSON 结构（不依赖插件字段名） */
export type ResultSummary = Record<string, unknown>

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

/** NPZ 附件解析后的频谱数据（仅 fft 视图使用） */
export interface SpectrumData {
  frequencies: Float64Array | Float32Array
  magnitudes: Float64Array | Float32Array
  samplingRate: number
}
