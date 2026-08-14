/**
 * 轻量 NPY（NumPy 数组文件）读取器。
 * 仅支持一维 float64 / float32 数组（大屏 FFT 结果解析所需）。
 * 参考 NPY 格式：magic `\x93NUMPY` + 版本 + header_len + ASCII header + 原始二进制数据。
 */

export interface NpyArray {
  /** 原始 dtype 描述，如 '<f8'、'<f4' */
  dtype: string
  /** 维度（一维时长度为 1，0-d 标量为空数组） */
  shape: number[]
  data: Float64Array | Float32Array
}

interface DtypeInfo {
  byteSize: number
  read: (view: DataView, byteOffset: number) => number
  kind: 'float64' | 'float32'
}

/** 支持的 dtype 描述：<f8/<f4 小端，>f8/>f4 大端，|f8/|f4 与 =f8/=f4 视作小端 */
function resolveDtype(descr: string): DtypeInfo {
  const m = descr.match(/^([<>|=])(f8|f4)$/)
  if (!m) throw new Error(`不支持的 NPY dtype: ${descr}`)
  const [, endian, size] = m
  const littleEndian = endian !== '>'
  if (size === 'f8') {
    return {
      byteSize: 8,
      kind: 'float64',
      read: (view, off) => view.getFloat64(off, littleEndian),
    }
  }
  return {
    byteSize: 4,
    kind: 'float32',
    read: (view, off) => view.getFloat32(off, littleEndian),
  }
}

/** 解析 NPY 文件字节，返回一维（或 0-d 标量）数组 */
export function parseNpy(buffer: ArrayBuffer): NpyArray {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) throw new Error('NPY 文件过短')
  // magic: \x93NUMPY
  const magic = '\x93NUMPY'
  for (let i = 0; i < 6; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) throw new Error('非法 NPY 文件头')
  }

  const major = bytes[6]
  const minor = bytes[7]
  let headerLen: number
  let headerOffset: number
  if (major === 1) {
    if (minor !== 0) throw new Error(`不支持的 NPY 版本: ${major}.${minor}`)
    headerLen = new DataView(buffer).getUint16(8, true)
    headerOffset = 10
  } else if (major === 2) {
    headerLen = new DataView(buffer).getUint32(8, true)
    headerOffset = 12
  } else {
    throw new Error(`不支持的 NPY 版本: ${major}`)
  }

  if (headerOffset + headerLen > bytes.length) throw new Error('NPY header 越界')
  const headerText = new TextDecoder().decode(bytes.subarray(headerOffset, headerOffset + headerLen))

  const descrMatch = headerText.match(/'descr'\s*:\s*'([^']+)'/)
  if (!descrMatch) throw new Error('NPY header 缺少 descr')
  const dtype = resolveDtype(descrMatch[1])

  const fortran = /'fortran_order'\s*:\s*True/.test(headerText)
  if (fortran) throw new Error('不支持 fortran_order 数组')

  const shapeMatch = headerText.match(/'shape'\s*:\s*\(([^)]*)\)/)
  if (!shapeMatch) throw new Error('NPY header 缺少 shape')
  const shape = shapeMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)
  // 仅支持一维（或 0-d 标量）
  if (shape.length > 1) throw new Error(`不支持多维数组 shape=${JSON.stringify(shape)}`)
  const count = shape.length === 0 ? 1 : shape[0]

  const dataOffset = headerOffset + headerLen
  const requiredBytes = dataOffset + count * dtype.byteSize
  if (requiredBytes > bytes.length) throw new Error('NPY 数据区越界')

  const view = new DataView(buffer)
  const data =
    dtype.kind === 'float64' ? new Float64Array(count) : new Float32Array(count)
  for (let i = 0; i < count; i++) {
    data[i] = dtype.read(view, dataOffset + i * dtype.byteSize)
  }

  return { dtype: descrMatch[1], shape, data }
}
