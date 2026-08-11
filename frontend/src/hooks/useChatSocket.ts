import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL, AUTH_ACCESS_TOKEN_CHANGED_EVENT, getAccessToken, refreshAccessToken } from '../services/apiClient'

type ChatSocketSubscriber = (event: string, payload: unknown) => void

const CHAT_EVENTS = [
  'message.created',
  'message.read',
  'conversation.updated',
  'conversation.closed',
  'conversation.dissolved',
  'conversation.memberChanged',
  'chat.restrictionChanged',
  'chat.storageWarning',
  'notification.created',
] as const

const subscribers = new Set<ChatSocketSubscriber>()
let socket: Socket | null = null
let connectionEstablished = false
let recoveryRequired = false
let retryServerDisconnect = false
let credentialRefresh: Promise<void> | null = null
let lastCredentialRefreshAt = 0

function publish(event: string, payload: unknown) {
  subscribers.forEach((subscriber) => subscriber(event, payload))
}

function getSocket() {
  if (socket) return socket
  const origin = API_BASE_URL.replace(/\/api$/, '')
  socket = io(`${origin}/chat`, {
    auth: { token: getAccessToken() ?? '' },
    autoConnect: false,
    transports: ['websocket', 'polling'],
  })
  CHAT_EVENTS.forEach((event) => socket?.on(event, (payload: unknown) => publish(event, payload)))
  socket.on('chat.connectionDenied', (payload: { code?: string }) => {
    retryServerDisconnect = payload.code === 'AUTHENTICATION_REQUIRED'
    publish('chat.connectionDenied', payload)
  })
  socket.on('connect', () => {
    if (connectionEstablished || recoveryRequired) publish('chat.connection.restored', { recovered: socket?.recovered ?? false })
    connectionEstablished = true
    recoveryRequired = false
  })
  socket.on('disconnect', (reason) => {
    recoveryRequired = connectionEstablished
    if (reason === 'io server disconnect' && retryServerDisconnect) void reconnectWithFreshCredential()
    retryServerDisconnect = false
  })
  socket.on('connect_error', () => {
    recoveryRequired = connectionEstablished
  })
  return socket
}

async function reconnectWithFreshCredential() {
  if (credentialRefresh) return credentialRefresh
  if (Date.now() - lastCredentialRefreshAt < 5_000) return
  lastCredentialRefreshAt = Date.now()
  credentialRefresh = refreshAccessToken()
    .then((token) => {
      if (!token || subscribers.size === 0) return
      const current = getSocket()
      current.auth = { token }
      if (!current.connected) current.connect()
    })
    .finally(() => {
      credentialRefresh = null
    })
  return credentialRefresh
}

function syncSocketCredential() {
  if (!socket) return
  const token = getAccessToken()
  socket.auth = { token: token ?? '' }
  if (!token) {
    socket.disconnect()
  } else if (subscribers.size > 0 && !socket.connected) {
    socket.connect()
  }
}

if (typeof window !== 'undefined') window.addEventListener(AUTH_ACCESS_TOKEN_CHANGED_EVENT, syncSocketCredential)

export function useChatSocket(onEvent: (event: string, payload: unknown) => void) {
  const callbackRef = useRef(onEvent)

  useEffect(() => {
    callbackRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    const subscriber: ChatSocketSubscriber = (event, payload) => callbackRef.current(event, payload)
    subscribers.add(subscriber)
    const current = getSocket()
    current.auth = { token }
    if (!current.connected) current.connect()
    return () => {
      subscribers.delete(subscriber)
      if (subscribers.size === 0) {
        current.disconnect()
        connectionEstablished = false
        recoveryRequired = false
        retryServerDisconnect = false
      }
    }
  }, [])
}
