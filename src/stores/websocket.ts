import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'
import { useWebSocket } from '@/composables/useWebSocket'
import type { RealtimePayload, WsMessage } from '@/types'

export const useWebSocketStore = defineStore('websocket', () => {
  /** 各测点最新实时值：point_id -> payload */
  const latestData = ref<Record<number, RealtimePayload>>({})
  /** 从实时流中动态发现的测点 id（无测点列表 API） */
  const knownPointIds = ref<number[]>([])
  const subscribedProjectId = ref<number | null>(null)
  /** 期望订阅的项目（重连后自动恢复订阅） */
  const desiredProjectId = ref<number | null>(null)

  function handleMessage(msg: WsMessage): void {
    if (msg.type === 'data:realtime') {
      const payload = (msg as { payload: RealtimePayload }).payload
      latestData.value[payload.point_id] = payload
      if (!knownPointIds.value.includes(payload.point_id)) {
        knownPointIds.value.push(payload.point_id)
      }
    } else if (msg.type === 'cmd:subscribed') {
      subscribedProjectId.value = (msg as { project_id: number }).project_id
    }
  }

  const socket = useWebSocket(handleMessage, () => desiredProjectId.value)

  function connect(): void {
    void socket.connect()
  }

  function disconnect(): void {
    desiredProjectId.value = null
    subscribedProjectId.value = null
    socket.disconnect()
  }

  /** 订阅项目实时数据；已连接且订阅不同项目时重连以改订阅 */
  function subscribeProject(projectId: number): void {
    if (desiredProjectId.value === projectId && socket.isConnected.value) return
    desiredProjectId.value = projectId
    if (socket.isConnected.value) {
      socket.reconnect()
    } else {
      void socket.connect()
    }
  }

  return {
    isConnected: socket.isConnected,
    latestData: readonly(latestData),
    knownPointIds: readonly(knownPointIds),
    subscribedProjectId: readonly(subscribedProjectId),
    connect,
    disconnect,
    subscribeProject,
  }
})
