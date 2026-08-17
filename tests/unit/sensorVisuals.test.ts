import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildSensorVisuals } from '@/utils/three/sensorVisuals'
import type { Sensor } from '@/types'

/** 构造一个最小 Sensor 对象用于单测 */
function mkSensor(over: Partial<Sensor> & { id: number; position: Sensor['position'] }): Sensor {
  return {
    device_id: 1,
    sensor_code: over.sensor_code ?? `S${over.id}`,
    sensor_name: over.sensor_name ?? null,
    sensor_type: null,
    model: null,
    manufacturer: null,
    install_date: null,
    last_calibration: null,
    metadata: null,
    note: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    ...over,
  } as Sensor
}

describe('buildSensorVisuals', () => {
  it('过滤掉 position=null 的 sensor，只保留有坐标的', () => {
    const sensors: Sensor[] = [
      mkSensor({ id: 1, position: { x: 1, y: 2, z: 3 } }),
      mkSensor({ id: 2, position: null }),
      mkSensor({ id: 3, position: { x: 10, y: 20, z: 30 } }),
    ]
    const visuals = buildSensorVisuals(sensors, {}, {})

    expect(visuals).toHaveLength(2)
    expect(visuals.map((v) => v.pointId)).toEqual([1, 3])
  })

  it('position 转 THREE.Vector3(x, y, z)', () => {
    const visuals = buildSensorVisuals(
      [mkSensor({ id: 1, position: { x: 1.5, y: 2.5, z: 3.5 } })],
      {},
      {},
    )
    expect(visuals[0].position).toBeInstanceOf(THREE.Vector3)
    expect(visuals[0].position.x).toBe(1.5)
    expect(visuals[0].position.y).toBe(2.5)
    expect(visuals[0].position.z).toBe(3.5)
  })

  it('传感器无通道时 value=0, status=normal', () => {
    const visuals = buildSensorVisuals(
      [mkSensor({ id: 1, position: { x: 0, y: 0, z: 0 } })],
      { 1: [] }, // 有 channelIdsBySensor[1]=[] 但无数据
      {},
    )
    expect(visuals[0].value).toBe(0)
    expect(visuals[0].status).toBe('normal')
  })

  it('取 channel 中 timestamp 最新的实时数据', () => {
    const visuals = buildSensorVisuals(
      [mkSensor({ id: 1, position: { x: 0, y: 0, z: 0 } })],
      { 1: [10, 20, 30] },
      {
        10: { timestamp: '2025-01-01T00:00:10Z', value: 1.1, quality: 'good' },
        20: { timestamp: '2025-01-01T00:00:30Z', value: 2.0, quality: 'good' },
        30: { timestamp: '2025-01-01T00:00:20Z', value: 3.0, quality: 'good' },
      },
    )
    expect(visuals[0].value).toBe(2.0)
    expect(visuals[0].status).toBe('normal') // good → normal
  })

  it('quality=bad → status=danger', () => {
    const visuals = buildSensorVisuals(
      [mkSensor({ id: 1, position: { x: 0, y: 0, z: 0 } })],
      { 1: [10] },
      { 10: { timestamp: '2025-01-01T00:00:00Z', value: 9.9, quality: 'bad' } },
    )
    expect(visuals[0].status).toBe('danger')
  })

  it('priority: 较新 timestamp 覆盖较旧 value', () => {
    // 同一 sensor 的两个 channel：channel 20 时间更新，覆盖 channel 10
    const visuals = buildSensorVisuals(
      [mkSensor({ id: 1, position: { x: 0, y: 0, z: 0 } })],
      { 1: [10, 20] },
      {
        10: { timestamp: '2025-01-01T00:00:00Z', value: 1.0, quality: 'good' },
        20: { timestamp: '2025-01-01T00:00:30Z', value: 5.0, quality: 'bad' },
      },
    )
    expect(visuals[0].value).toBe(5.0)
    expect(visuals[0].status).toBe('danger')
  })

  it('pointId 即 sensor.id（用于点击射线检测时反查通道）', () => {
    const visuals = buildSensorVisuals(
      [
        mkSensor({ id: 42, position: { x: 1, y: 1, z: 1 } }),
        mkSensor({ id: 99, position: { x: 2, y: 2, z: 2 } }),
      ],
      {},
      {},
    )
    expect(visuals.map((v) => v.pointId)).toEqual([42, 99])
  })

  it('name 优先用 sensor_name，回退到 sensor_code', () => {
    const withName = mkSensor({
      id: 1,
      position: { x: 0, y: 0, z: 0 },
      sensor_code: 'CODE-1',
      sensor_name: 'Display Name 1',
    })
    const withoutName = mkSensor({
      id: 2,
      position: { x: 0, y: 0, z: 0 },
      sensor_code: 'CODE-2',
      sensor_name: null,
    })
    const visuals = buildSensorVisuals([withName, withoutName], {}, {})
    expect(visuals[0].name).toBe('Display Name 1')
    expect(visuals[1].name).toBe('CODE-2')
  })

  it('空 sensor 列表返回空数组（不抛错）', () => {
    expect(buildSensorVisuals([], {}, {})).toEqual([])
  })

  it('所有 sensor 都没 position → 空数组', () => {
    const sensors = [
      mkSensor({ id: 1, position: null }),
      mkSensor({ id: 2, position: null }),
    ]
    expect(buildSensorVisuals(sensors, {}, {})).toEqual([])
  })
})