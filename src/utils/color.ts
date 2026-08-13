import type { PointStatus, Quality } from '@/types'

export const STATUS_COLORS: Record<PointStatus, string> = {
  normal: '#67C23A',
  warning: '#E6A23C',
  danger: '#F56C6C',
}

export const UNKNOWN_COLOR = '#909399'

/** 状态 → 颜色（未知状态给灰色） */
export function statusColor(status: PointStatus | string | null | undefined): string {
  if (status === 'normal' || status === 'warning' || status === 'danger') {
    return STATUS_COLORS[status]
  }
  return UNKNOWN_COLOR
}

/** 数据质量 → 测点状态 */
export function qualityToStatus(quality: Quality | string | null | undefined): PointStatus {
  switch (quality) {
    case 'bad':
      return 'danger'
    case 'uncertain':
      return 'warning'
    default:
      return 'normal'
  }
}

/** 数据质量 → 颜色 */
export function qualityColor(quality: Quality | string | null | undefined): string {
  return statusColor(qualityToStatus(quality))
}
