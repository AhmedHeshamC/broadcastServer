import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { messageApi } from '@/services/api'
import type { Message, User as ChatUser, MessageType } from '@/types/types'

export interface ConnectedUser {
  id: string
  username: string
  role: string
  socketId?: string
}

export interface TypingUser {
  username: string
  timestamp: number
}

export const useChatStore = defineStore('chat', () => {
  const socket = ref<WebSocket | null>(null)
  const messages = ref<Message[]>([])
  const connectedUsers = ref<ConnectedUser[]>([])
  const typingUsers = ref<TypingUser[]>([])
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)
  const yourUsername = ref<string | null>(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  const authStore = useAuthStore()

  const sortedMessages = computed(() =>
    messages.value.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  )

  const connect = () => {
    if (!authStore.token) {
      throw new Error('Authentication token required for WebSocket connection')
    }

    const wsUrl = `ws://localhost:3000/ws?token=${authStore.token}`

    try {
      socket.value = new WebSocket(wsUrl)

      socket.value.onopen = () => {
        console.log('WebSocket connection established')
        isConnected.value = true
        connectionError.value = null
        reconnectAttempts.value = 0
      }

      socket.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      socket.value.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason)
        isConnected.value = false

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          console.log(`Attempting to reconnect... (${reconnectAttempts.value}/${maxReconnectAttempts})`)
          setTimeout(connect, 3000)
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          connectionError.value = 'Connection lost. Please refresh the page.'
        }
      }

      socket.value.onerror = (error) => {
        console.error('WebSocket error:', error)
        connectionError.value = 'Failed to connect to chat server'
        isConnected.value = false
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      connectionError.value = 'Failed to connect to chat server'
      isConnected.value = false
    }
  }

  const handleWebSocketMessage = (data: any) => {
    // Handle both wrapped { type, payload } and direct message formats
    const message = data.payload ? data : data
    const { type } = message

    switch (type) {
      case 'message':
        if (message.content && message.senderName) {
          messages.value.push({
            id: Date.now().toString(),
            content: message.content,
            sender: message.senderName,
            timestamp: message.timestamp,
            type: 'user'
          })
        }
        break

      case 'user_list':
        if (payload.users) {
          connectedUsers.value = payload.users.map((user: any) => ({
            id: user.id,
            username: user.username,
            role: user.role,
            socketId: user.socketId
          }))
        }
        break

      case 'user_connected':
        if (payload.user) {
          connectedUsers.value.push({
            id: payload.user.id,
            username: payload.user.username,
            role: payload.user.role,
            socketId: payload.user.socketId
          })
        }
        break

      case 'user_disconnected':
        if (payload.userId) {
          connectedUsers.value = connectedUsers.value.filter(
            user => user.id !== payload.userId
          )
        }
        break

      case 'user_typing':
        if (payload.username) {
          const existingIndex = typingUsers.value.findIndex(
            user => user.username === payload.username
          )

          if (existingIndex >= 0) {
            typingUsers.value[existingIndex].timestamp = Date.now()
          } else {
            typingUsers.value.push({
              username: payload.username,
              timestamp: Date.now()
            })
          }
        }
        break

      case 'user_stop_typing':
        if (payload.username) {
          typingUsers.value = typingUsers.value.filter(
            user => user.username !== payload.username
          )
        }
        break

      case 'your_name':
        if (payload.name) {
          yourUsername.value = payload.name
        }
        break

      case 'system':
        if (payload.message) {
          messages.value.push({
            id: Date.now().toString(),
            content: payload.message,
            sender: 'System',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        }
        break

      default:
        console.log('Unknown message type:', type)
    }
  }

  const disconnect = () => {
    if (socket.value) {
      socket.value.close()
      socket.value = null
    }
    isConnected.value = false
    connectedUsers.value = []
    typingUsers.value = []
    yourUsername.value = null
    reconnectAttempts.value = 0
  }

  const sendMessage = (content: string) => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({
        type: 'message',
        payload: { content }
      }))
    } else {
      console.error('Cannot send message: WebSocket not connected')
    }
  }

  const sendTyping = () => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({
        type: 'typing'
      }))
    }
  }

  const sendStopTyping = () => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({
        type: 'stop_typing'
      }))
    }
  }

  const loadMessageHistory = async (limit = 50) => {
    try {
      const response = await messageApi.getMessages(limit)
      messages.value = response.messages
      return response
    } catch (error) {
      console.error('Failed to load message history:', error)
      throw error
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  // Clean up typing indicators that are older than 3 seconds
  const cleanupTypingIndicators = () => {
    const now = Date.now()
    typingUsers.value = typingUsers.value.filter(user => now - user.timestamp < 3000)
  }

  // Start cleanup interval
  setInterval(cleanupTypingIndicators, 1000)

  return {
    messages: computed(() => sortedMessages.value),
    connectedUsers: computed(() => connectedUsers.value),
    typingUsers: computed(() => typingUsers.value),
    isConnected: computed(() => isConnected.value),
    connectionError: computed(() => connectionError.value),
    yourUsername: computed(() => yourUsername.value),
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    sendStopTyping,
    loadMessageHistory,
    clearMessages
  }
})