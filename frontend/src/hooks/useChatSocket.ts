import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL, getAccessToken } from '../services/apiClient'

export function useChatSocket(onEvent: (event: string, payload: unknown) => void) {
  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    const origin = API_BASE_URL.replace(/\/api$/, '')
    const socket = io(`${origin}/chat`, { auth: { token }, transports: ['websocket', 'polling'] })
    const events = ['message.created', 'message.read', 'conversation.updated', 'conversation.closed', 'conversation.dissolved', 'conversation.memberChanged', 'chat.restrictionChanged', 'chat.storageWarning', 'notification.created']
    events.forEach((event) => socket.on(event, (payload: unknown) => onEvent(event, payload)))
    return () => { socket.disconnect() }
  }, [onEvent])
}
