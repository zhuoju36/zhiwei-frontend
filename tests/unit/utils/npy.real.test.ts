import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseNpy } from '@/utils/npy'

/** readFileSync 的 Buffer 可能来自共享池，拷贝成独立 ArrayBuffer 再解析 */
function loadNpy(path: string): ArrayBuffer {
  const bytes = readFileSync(path)
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  return ab
}

describe('parseNpy 真实后端 NPZ 文件', () => {
  it('解析后端 FFT 结果的 frequencies/magnitudes/sampling_rate', () => {
    const freqs = parseNpy(loadNpy('tests/unit/utils/frequencies.npy'))
    const mags = parseNpy(loadNpy('tests/unit/utils/magnitudes.npy'))
    const sr = parseNpy(loadNpy('tests/unit/utils/sampling_rate.npy'))
    expect(freqs.shape).toEqual([61])
    expect(freqs.data[0]).toBe(0)
    expect(freqs.data[4]).toBeCloseTo(3.3057851239669422)
    expect(mags.shape).toEqual([61])
    expect(mags.data[4]).toBeCloseTo(4.860363522067585)
    // 0-d 标量 → 长度为 1
    expect(sr.shape).toEqual([])
    expect(Number(sr.data[0])).toBe(100)
  })
})
