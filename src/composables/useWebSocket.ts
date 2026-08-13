import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import type { WsMessage } from '@/types'

const WS_PATH: string = import.meta.env.VITE_WS_URL || '/ws'
const MAX_RECONNECT_DELAY = 30_000

/**
 * WebSocket 封装：连接 /ws/data、断线指数退避重连（重连后自动重新订阅）、
 * 4401（token 无效）时先刷新 token 再重连。
 * 注意：后端无心跳/pong，不发送 ping。
 */
export function useWebSocket(
  onMessage: (msg: WsMessage) => void,
  getProjectId: () => number | null,
) {
  const isConnected = ref(false)
  let ws: WebSocket | null = null
  let manualClose = false
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function buildUrl(token: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${WS_PATH}/data?token=${encodeURIComponent(token)}`
  }

  function send(data: object): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect(): void {
    clearReconnectTimer()
    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      void connect()
    }, delay)
  }

  async function connect(): Promise<void> {
    clearReconnectTimer()
    manualClose = false
    const userStore = useUserStore()
    if (!userStore.token) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    ws = new WebSocket(buildUrl(userStore.token))

    ws.onopen = () => {
      isConnected.value = true
      reconnectAttempts = 0
      // 连接（含重连）后立即订阅当前项目
      const pid = getProjectId()
      if (pid != null) {
        send({ type: 'cmd:subscribe', project_id: pid })
      }
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        onMessage(JSON.parse(event.data) as WsMessage)
      } catch {
        // 忽略无法解析的消息
      }
    }

    ws.onerror = () => {
      ws?.close()
    }

    ws.onclose = (event: CloseEvent) => {
      isConnected.value = false
      ws = null
      if (manualClose) return
      if (event.code === 4401) {
        // token 无效：先刷新再重连，刷新失败则登出
        void userStore.refresh().then((ok) => {
          if (ok) {
            void connect()
          } else {
            userStore.logout()
            window.location.href = '/login'
          }
        })
        return
      }
      scheduleReconnect()
    }
  }

  function disconnect(): void {
    manualClose = true
    clearReconnectTimer()
    ws?.close()
    ws = null
    isConnected.value = false
  }

  /** 立即断开并重连（用于切换订阅项目，后端不支持改订阅） */
  function reconnect(): void {
    disconnect()
    manualClose = false
    reconnectAttempts = 0
    void connect()
  }

  return { isConnected, connect, disconnect, reconnect, send }
}
