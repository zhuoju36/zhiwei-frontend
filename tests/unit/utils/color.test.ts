import { describe, expect, it } from 'vitest'
import {
  STATUS_COLORS,
  UNKNOWN_COLOR,
  qualityColor,
  qualityToStatus,
  statusColor,
} from '@/utils/color'

describe('statusColor', () => {
  it('映射三种状态颜色', () => {
    expect(statusColor('normal')).toBe(STATUS_COLORS.normal)
    expect(statusColor('warning')).toBe(STATUS_COLORS.warning)
    expect(statusColor('danger')).toBe(STATUS_COLORS.danger)
  })

  it('未知状态返回灰色', () => {
    expect(statusColor('offline')).toBe(UNKNOWN_COLOR)
    expect(statusColor(null)).toBe(UNKNOWN_COLOR)
    expect(statusColor(undefined)).toBe(UNKNOWN_COLOR)
  })
})

describe('qualityToStatus', () => {
  it('good -> normal, uncertain -> warning, bad -> danger', () => {
    expect(qualityToStatus('good')).toBe('normal')
    expect(qualityToStatus('uncertain')).toBe('warning')
    expect(qualityToStatus('bad')).toBe('danger')
  })

  it('未知质量按 normal 处理', () => {
    expect(qualityToStatus('whatever')).toBe('normal')
    expect(qualityToStatus(null)).toBe('normal')
  })
})

describe('qualityColor', () => {
  it('质量颜色与状态颜色一致', () => {
    expect(qualityColor('good')).toBe(STATUS_COLORS.normal)
    expect(qualityColor('uncertain')).toBe(STATUS_COLORS.warning)
    expect(qualityColor('bad')).toBe(STATUS_COLORS.danger)
  })
})
