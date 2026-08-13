/**
 * 数值格式化：保留 digits 位小数并去掉末尾多余的 0。
 * null/undefined/NaN 显示为 '-'。
 */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '-'
  return String(Number(value.toFixed(digits)))
}

/** 带单位的数值展示，如 "1.23 mm" */
export function formatValue(value: number | null | undefined, unit?: string | null, digits = 2): string {
  const num = formatNumber(value, digits)
  return unit ? `${num} ${unit}` : num
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * 时间格式化为 "YYYY-MM-DD HH:mm:ss"（withSeconds=false 时到分钟）。
 * 非法输入返回 '-'。
 */
export function formatTime(input: string | number | Date | null | undefined, withSeconds = true): string {
  if (input == null || input === '') return '-'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = withSeconds
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${date} ${time}`
}
