import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElNotification } from 'element-plus'
import { useWebSocket } from '@/composables/useWebSocket'
import type { RealtimePayload, WsAlertPayload, WsMessage } from '@/types'

export const useWebSocketStore = defineStore('websocket', () => {
  /** 各通道最新实时值：channel_id -> payload */
  const latestData = ref<Record<number, RealtimePayload>>({})
  /** 从实时流中动态发现的通道 id（无通道列表 API） */
  const knownChannelIds = ref<number[]>([])
  const subscribedSubitemId = ref<number | null>(null)
  /** 期望订阅的子项（重连后自动恢复订阅） */
  const desiredSubitemId = ref<number | null>(null)
  /** 活跃告警（WS data:alert 推送；resolved 帧移除） */
  const alerts = ref<WsAlertPayload[]>([])
  /** 订阅被拒绝等 WS 错误记录 */
  const wsErrors = ref<string[]>([])

  function handleAlert(payload: WsAlertPayload): void {
    if (payload.status === 'resolved') {
      alerts.value = alerts.value.filter((a) => a.alert_id !== payload.alert_id)
      return
    }
    const idx = alerts.value.findIndex((a) => a.alert_id === payload.alert_id)
    if (idx >= 0) {
      alerts.value.splice(idx, 1, payload)
    } else {
      alerts.value.unshift(payload)
    }
    if (payload.status === 'triggered') {
      ElNotification({
        title: `通道告警（${payload.level}）`,
        message: payload.message ?? `通道 #${payload.channel_id} 触发阈值告警`,
        type: 'warning',
        duration: 5000,
      })
    }
  }

  function handleMessage(msg: WsMessage): void {
    if (msg.type === 'data:realtime') {
      // WsMessage 含兜底成员，需显式断言到具体 payload 结构
      const payload = (msg as { payload: RealtimePayload }).payload
      latestData.value[payload.channel_id] = payload
      if (!knownChannelIds.value.includes(payload.channel_id)) {
        knownChannelIds.value.push(payload.channel_id)
      }
    } else if (msg.type === 'data:alert') {
      handleAlert((msg as { payload: WsAlertPayload }).payload)
    } else if (msg.type === 'cmd:subscribed') {
      subscribedSubitemId.value = (msg as { subitem_id: number }).subitem_id
    } else if (msg.type === 'cmd:error') {
      const err = msg as { code: string; message: string }
      // 订阅被拒绝（如 FORBIDDEN）；后端不关闭连接，保持现状等待
      wsErrors.value.push(`${err.code}: ${err.message}`)
      ElNotification.error({ title: '实时订阅失败', message: err.message, duration: 3000 })
    }
  }

  const socket = useWebSocket(handleMessage, () => desiredSubitemId.value)

  function connect(): void {
    void socket.connect()
  }

  function disconnect(): void {
    desiredSubitemId.value = null
    subscribedSubitemId.value = null
    socket.disconnect()
  }

  /** 订阅子项实时数据；已连接且订阅不同子项时重连以改订阅 */
  function subscribeSubitem(subitemId: number): void {
    if (desiredSubitemId.value === subitemId && socket.isConnected.value) return
    desiredSubitemId.value = subitemId
    if (socket.isConnected.value) {
      socket.reconnect()
    } else {
      void socket.connect()
    }
  }

  return {
    isConnected: socket.isConnected,
    latestData: readonly(latestData),
    knownChannelIds: readonly(knownChannelIds),
    subscribedSubitemId: readonly(subscribedSubitemId),
    alerts: readonly(alerts),
    wsErrors: readonly(wsErrors),
    connect,
    disconnect,
    subscribeSubitem,
  }
})
