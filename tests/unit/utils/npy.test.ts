import { describe, expect, it } from 'vitest'
import { parseNpy } from '@/utils/npy'

/**
 * 构造 NPY v1.0 字节：magic + 版本 + header_len(u16 LE) + header dict（空格填充到 64 对齐）+ 数据。
 * 与 numpy.lib.format 一致：10 + len(header) ≡ 0 (mod 64)。
 */
function buildNpyV1(descr: string, shape: number[], values: number[], littleEndian = true): ArrayBuffer {
  const shapeText = shape.length === 0 ? '()' : `(${shape.join(', ')},)`
  const dict = `{'descr': '${descr}', 'fortran_order': False, 'shape': ${shapeText}, }`
  const headerLenBase = 10 + dict.length
  const padLen = (64 - (headerLenBase % 64)) % 64
  const header = dict + ' '.repeat(padLen) + '\n'

  const bytesPerElem = descr.endsWith('f8') ? 8 : 4
  const buffer = new ArrayBuffer(10 + header.length + values.length * bytesPerElem)
  const bytes = new Uint8Array(buffer)
  // magic
  bytes[0] = 0x93
  bytes[1] = 0x4e
  bytes[2] = 0x55
  bytes[3] = 0x4d
  bytes[4] = 0x50
  bytes[5] = 0x59
  // 版本 1.0
  bytes[6] = 0x01
  bytes[7] = 0x00
  // header_len（小端）
  new DataView(buffer).setUint16(8, header.length, true)
  // header
  new Uint8Array(buffer).set(new TextEncoder().encode(header), 10)
  // 数据
  const view = new DataView(buffer)
  const offset = 10 + header.length
  if (bytesPerElem === 8) {
    values.forEach((v, i) => view.setFloat64(offset + i * 8, v, littleEndian))
  } else {
    values.forEach((v, i) => view.setFloat32(offset + i * 4, v, littleEndian))
  }
  return buffer
}

/** 构造 NPY v2.0 字节（header_len 为 u32 LE，偏移 12） */
function buildNpyV2(descr: string, shape: number[], values: number[]): ArrayBuffer {
  const shapeText = shape.length === 0 ? '()' : `(${shape.join(', ')},)`
  const dict = `{'descr': '${descr}', 'fortran_order': False, 'shape': ${shapeText}, }`
  const headerLenBase = 12 + dict.length
  const padLen = (64 - (headerLenBase % 64)) % 64
  const header = dict + ' '.repeat(padLen) + '\n'

  const bytesPerElem = 8
  const buffer = new ArrayBuffer(12 + header.length + values.length * bytesPerElem)
  const bytes = new Uint8Array(buffer)
  bytes[0] = 0x93
  bytes[1] = 0x4e
  bytes[2] = 0x55
  bytes[3] = 0x4d
  bytes[4] = 0x50
  bytes[5] = 0x59
  bytes[6] = 0x02
  bytes[7] = 0x00
  new DataView(buffer).setUint32(8, header.length, true)
  new Uint8Array(buffer).set(new TextEncoder().encode(header), 12)
  const view = new DataView(buffer)
  values.forEach((v, i) => view.setFloat64(12 + header.length + i * 8, v, true))
  return buffer
}

describe('parseNpy', () => {
  it('解析 float64 一维数组（v1 小端）', () => {
    const buffer = buildNpyV1('<f8', [4], [1, -2, 3.5, 100])
    const arr = parseNpy(buffer)
    expect(arr.dtype).toBe('<f8')
    expect(arr.shape).toEqual([4])
    expect(Array.from(arr.data)).toEqual([1, -2, 3.5, 100])
    expect(arr.data).toBeInstanceOf(Float64Array)
  })

  it('解析 float32 一维数组（v1 小端）', () => {
    const buffer = buildNpyV1('<f4', [3], [1.5, 2.5, -3.25])
    const arr = parseNpy(buffer)
    expect(arr.dtype).toBe('<f4')
    expect(arr.shape).toEqual([3])
    expect(Array.from(arr.data)).toEqual([1.5, 2.5, -3.25])
    expect(arr.data).toBeInstanceOf(Float32Array)
  })

  it('解析大端 float64', () => {
    const buffer = buildNpyV1('>f8', [2], [1, 2], false)
    const arr = parseNpy(buffer)
    expect(Array.from(arr.data)).toEqual([1, 2])
  })

  it('解析 v2.0 头', () => {
    const buffer = buildNpyV2('<f8', [2], [10, 20])
    const arr = parseNpy(buffer)
    expect(Array.from(arr.data)).toEqual([10, 20])
  })

  it('解析 0-d 标量（shape=()）', () => {
    const buffer = buildNpyV1('<f8', [], [42])
    const arr = parseNpy(buffer)
    expect(arr.shape).toEqual([])
    expect(Array.from(arr.data)).toEqual([42])
  })

  it('非法文件头抛错', () => {
    const buffer = new ArrayBuffer(64)
    expect(() => parseNpy(buffer)).toThrow()
  })

  it('不支持的 dtype 抛错', () => {
    const buffer = buildNpyV1('<i8', [2], [1, 2])
    expect(() => parseNpy(buffer)).toThrow(/dtype/)
  })

  it('多维数组抛错', () => {
    const buffer = buildNpyV1('<f8', [2, 2], [1, 2, 3, 4])
    expect(() => parseNpy(buffer)).toThrow(/多维/)
  })

  it('数据区越界抛错', () => {
    const buffer = buildNpyV1('<f8', [5], [1, 2, 3])
    expect(() => parseNpy(buffer)).toThrow()
  })
})
