import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'
import type { User, LoginRequest, RegisterRequest } from '@/types/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  const setTokens = (accessToken: string, refresh: string) => {
    token.value = accessToken
    refreshToken.value = refresh
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refreshToken', refresh)
  }

  const clearTokens = () => {
    token.value = null
    refreshToken.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  const login = async (credentials: LoginRequest) => {
    try {
      loading.value = true
      error.value = null

      const response = await authApi.login(credentials)

      // Extract tokens from nested data structure
      if (response.success && response.data) {
        setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken)
        user.value = response.data.user
      } else {
        throw new Error('Invalid response format')
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const register = async (userData: RegisterRequest) => {
    try {
      loading.value = true
      error.value = null

      const response = await authApi.register(userData)

      // Extract tokens from nested data structure
      if (response.success && response.data) {
        setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken)
        user.value = response.data.user
      } else {
        throw new Error('Invalid response format')
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Registration failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      if (token.value) {
        await authApi.logout()
      }
    } catch (err) {
      // Continue with logout even if API call fails
      console.error('Logout error:', err)
    } finally {
      clearTokens()
      user.value = null
      error.value = null
    }
  }

  const getCurrentUser = async () => {
    try {
      loading.value = true
      error.value = null

      const response = await authApi.getCurrentUser()
      user.value = response.user

      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to get user info'
      clearTokens()
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshAccessToken = async () => {
    try {
      if (!refreshToken.value) {
        throw new Error('No refresh token available')
      }

      const response = await authApi.refreshToken(refreshToken.value)
      token.value = response.accessToken
      localStorage.setItem('token', response.accessToken)

      return response.accessToken
    } catch (err) {
      clearTokens()
      throw err
    }
  }

  const updateUser = (userData: Partial<User>) => {
    if (user.value) {
      user.value = { ...user.value, ...userData }
    }
  }

  const clearError = () => {
    error.value = null
  }

  const getGoogleAuthUrl = () => {
    return authApi.getGoogleAuthUrl()
  }

  const getGithubAuthUrl = () => {
    return authApi.getGithubAuthUrl()
  }

  return {
    user: computed(() => user.value),
    token: computed(() => token.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    getCurrentUser,
    refreshAccessToken,
    updateUser,
    clearError,
    getGoogleAuthUrl,
    getGithubAuthUrl,
    setTokens,
    clearTokens,
    // Expose the refs for direct assignment in OAuth callback
    _user: user,
    _token: token
  }
})