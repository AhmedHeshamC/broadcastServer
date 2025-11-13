// User types
export interface User {
  _id: string
  username: string
  email: string
  role: 'user' | 'admin'
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLogin?: string
  oauthProvider?: string
  oauthId?: string
}

export interface UserBase {
  username: string
  email: string
  password?: string
  role?: 'user' | 'admin'
}

// Auth types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword?: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  message: string
}

// Message types
export interface Message {
  _id?: string
  content: string
  senderId?: string
  senderName?: string
  type?: 'message' | 'system' | 'user_joined' | 'user_left' | 'typing' | 'stop_typing' | 'your_name'
  timestamp: string | Date
  username?: string
}

export enum MessageType {
  MESSAGE = 'message',
  SYSTEM = 'system',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  TYPING = 'typing',
  STOP_TYPING = 'stop_typing',
  YOUR_NAME = 'your_name'
}

// WebSocket types
export interface WebSocketMessage {
  type: MessageType
  content?: string
  timestamp: string | Date
  username?: string
  senderId?: string
  senderName?: string
  userId?: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface UserListResponse extends PaginatedResponse<User> {
  users: User[]
}

export interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalConnections: number
  totalMessages: number
  usersOnline: number
  systemUptime: number
  memoryUsage?: any
  redis?: {
    connected: boolean
    stats?: any
  }
}

// Audit Log types
export interface AuditLog {
  _id: string
  userId: string
  username: string
  eventType: string
  ipAddress: string
  userAgent?: string
  details?: any
  success: boolean
  timestamp: string
}

export interface AuditLogResponse extends PaginatedResponse<AuditLog> {
  auditLogs: AuditLog[]
}

export enum AuditEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_DELETED = 'message_deleted',
  USER_BANNED = 'user_banned',
  USER_UNBANNED = 'user_unbanned',
  ROLE_CHANGED = 'role_changed',
  WEBSOCKET_CONNECTED = 'websocket_connected',
  WEBSOCKET_DISCONNECTED = 'websocket_disconnected'
}

// Form types
export interface FormErrors {
  [key: string]: string | null
}

export interface SnackbarOptions {
  message: string
  color?: 'success' | 'error' | 'warning' | 'info'
  timeout?: number
  show?: boolean
}

// Chat state types
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

// Admin types
export interface UserFilters {
  role?: 'user' | 'admin'
  status?: 'active' | 'inactive'
  search?: string
}

export interface AuditLogFilters {
  userId?: string
  eventType?: string
  startDate?: string
  endDate?: string
  success?: boolean
}

// OAuth types
export interface OAuthProfile {
  id: string
  displayName: string
  email: string
  photos?: Array<{ value: string }>
  provider: string
}

// Environment types
export interface EnvConfig {
  apiUrl: string
  wsUrl: string
  oauth: {
    google: {
      clientId: string
    }
    github: {
      clientId: string
    }
  }
}