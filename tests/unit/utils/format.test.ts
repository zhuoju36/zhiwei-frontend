import { describe, expect, it } from 'vitest'
import { formatNumber, formatTime, formatValue } from '@/utils/format'

describe('formatNumber', () => {
  it('保留指定小数位并去掉末尾多余的 0', () => {
    expect(formatNumber(1.23456)).toBe('1.23')
    expect(formatNumber(1.2)).toBe('1.2')
    expect(formatNumber(2)).toBe('2')
    expect(formatNumber(1.005)).toBe('1')
  })

  it('支持自定义小数位', () => {
    expect(formatNumber(3.14159, 4)).toBe('3.1416')
    expect(formatNumber(3.5, 0)).toBe('4')
  })

  it('空值与非法值显示为 -', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber(undefined)).toBe('-')
    expect(formatNumber(NaN)).toBe('-')
  })
})

describe('formatValue', () => {
  it('拼接单位', () => {
    expect(formatValue(1.234, 'mm')).toBe('1.23 mm')
  })

  it('无单位时只有数值', () => {
    expect(formatValue(1.5)).toBe('1.5')
    expect(formatValue(1.5, null)).toBe('1.5')
  })
})

describe('formatTime', () => {
  it('格式化为 YYYY-MM-DD HH:mm:ss', () => {
    expect(formatTime(new Date(2024, 0, 5, 3, 4, 5))).toBe('2024-01-05 03:04:05')
  })

  it('withSeconds=false 时精确到分钟', () => {
    expect(formatTime(new Date(2024, 11, 31, 23, 59, 58), false)).toBe('2024-12-31 23:59')
  })

  it('接受时间戳与 ISO 字符串', () => {
    const d = new Date(2024, 5, 15, 12, 30, 45)
    expect(formatTime(d.getTime())).toBe('2024-06-15 12:30:45')
    expect(formatTime(d.toISOString())).toBe(formatTime(d))
  })

  it('非法输入返回 -', () => {
    expect(formatTime(null)).toBe('-')
    expect(formatTime('not-a-date')).toBe('-')
  })
})
