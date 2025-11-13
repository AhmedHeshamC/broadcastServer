import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth'
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  Message,
  UserListResponse,
  SystemStats,
  AuditLog,
  AuditLogResponse,
  ApiResponse
} from '@/types/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          const authStore = useAuthStore()

          try {
            await authStore.refreshAccessToken()
            const newToken = localStorage.getItem('token')

            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return this.api(originalRequest)
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            authStore.logout()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Health check
  async healthCheck() {
    const response = await this.api.get('/health')
    return response.data
  }

  // API info
  async getApiInfo() {
    const response = await this.api.get('/api')
    return response.data
  }
}

class AuthApiService extends ApiService {
  async login(credentials: LoginRequest): Promise<ApiResponse<{user: User, tokens: {accessToken: string, refreshToken: string}}>> {
    const response = await this.api.post('/api/auth/login', credentials)
    return response.data
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<{user: User, tokens: {accessToken: string, refreshToken: string}}>> {
    const response = await this.api.post('/api/auth/register', userData)
    return response.data
  }

  async logout(): Promise<void> {
    await this.api.post('/api/auth/logout')
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response = await this.api.get('/api/auth/profile')
    return response.data
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await this.api.post('/api/auth/refresh', { refreshToken })
    return response.data
  }

  // OAuth URLs
  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/api/auth/google`
  }

  getGithubAuthUrl(): string {
    return `${API_BASE_URL}/api/auth/github`
  }
}

class MessageApiService extends ApiService {
  async getMessages(limit = 50, offset = 0): Promise<{ messages: Message[]; total: number }> {
    // TODO: Implement message endpoints in backend
    // const response = await this.api.get(`/api/messages?limit=${limit}&offset=${offset}`)
    // return response.data
    return { messages: [], total: 0 }
  }

  async deleteMessage(messageId: string): Promise<void> {
    // TODO: Implement message endpoints in backend
    // await this.api.delete(`/api/messages/${messageId}`)
  }
}

class AdminApiService extends ApiService {
  async getAllUsers(page = 1, limit = 20): Promise<UserListResponse> {
    const response = await this.api.get(`/api/admin/users?page=${page}&limit=${limit}`)
    return response.data
  }

  async getUserById(userId: string): Promise<{ user: User }> {
    const response = await this.api.get(`/api/admin/users/${userId}`)
    return response.data
  }

  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<{ user: User }> {
    const response = await this.api.put(`/api/admin/users/${userId}/role`, { role })
    return response.data
  }

  async toggleUserBan(userId: string): Promise<{ user: User }> {
    const response = await this.api.put(`/api/admin/users/${userId}/ban`)
    return response.data
  }

  async getSystemStats(): Promise<SystemStats> {
    const response = await this.api.get('/api/admin/stats')
    return response.data
  }

  async getAuditLogs(page = 1, limit = 50, filters?: {
    userId?: string
    eventType?: string
    startDate?: string
    endDate?: string
  }): Promise<AuditLogResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(filters && Object.entries(filters).reduce((acc, [key, value]) => {
        if (value) acc[key] = value
        return acc
      }, {} as Record<string, string>))
    })

    const response = await this.api.get(`/api/admin/audit-logs?${params}`)
    return response.data
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.api.delete(`/api/admin/messages/${messageId}`)
  }
}

// Export singleton instances
export const api = new ApiService()
export const authApi = new AuthApiService()
export const messageApi = new MessageApiService()
export const adminApi = new AdminApiService()