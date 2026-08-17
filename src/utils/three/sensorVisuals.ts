import * as THREE from 'three'
import type { Sensor, PointStatus } from '@/types'
import type { PointVisual } from '@/components/ThreeScene/PointManager'
import { qualityToStatus } from '@/utils/color'

/**
 * 把 sensors + 通道映射 + 最新实时数据转成 3D 测点视觉。
 *
 * 行为契约：
 * - 过滤掉 position=null 的 sensor（无坐标不渲染）
 * - 多个通道时取 timestamp 最新的 value / quality
 * - 无通道或无实时数据时 value=0, status='normal'
 * - pointId = sensor.id（用于点击射线反查通道）
 * - name 优先 sensor_name，回退 sensor_code
 */
export function buildSensorVisuals(
  sensors: Sensor[],
  channelIdsBySensor: Record<number, number[]>,
  latestData: Record<number, { timestamp: string; value: number; quality: string }>,
): PointVisual[] {
  return sensors
    .filter((s) => s.position != null)
    .map((s) => {
      let value = 0
      let status: PointStatus = 'normal'
      let latestTs = -1
      const channelIds = channelIdsBySensor[s.id] ?? []
      channelIds.forEach((cid) => {
        const rt = latestData[cid]
        if (!rt) return
        const ts = new Date(rt.timestamp).getTime()
        if (ts > latestTs) {
          latestTs = ts
          value = rt.value
          status = qualityToStatus(rt.quality)
        }
      })
      return {
        pointId: s.id,
        position: new THREE.Vector3(s.position!.x, s.position!.y, s.position!.z),
        status,
        value,
        name: s.sensor_name ?? s.sensor_code,
      }
    })
}