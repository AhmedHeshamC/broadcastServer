<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { RegisterRequest } from '@/types/types'

const router = useRouter()
const authStore = useAuthStore()

const form = ref<RegisterRequest>({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)

const errors = ref<Record<string, string>>({})

const isFormValid = computed(() => {
  return (
    form.value.username &&
    form.value.email &&
    form.value.password &&
    form.value.confirmPassword &&
    form.value.username.length >= 3 &&
    form.value.password.length >= 6 &&
    form.value.password === form.value.confirmPassword
  )
})

const validateForm = () => {
  const newErrors: Record<string, string> = {}

  // Username validation
  if (!form.value.username) {
    newErrors.username = 'Username is required'
  } else if (form.value.username.length < 3) {
    newErrors.username = 'Username must be at least 3 characters'
  } else if (!/^[a-zA-Z0-9_]+$/.test(form.value.username)) {
    newErrors.username = 'Username can only contain letters, numbers, and underscores'
  }

  // Email validation
  if (!form.value.email) {
    newErrors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    newErrors.email = 'Please enter a valid email address'
  }

  // Password validation
  if (!form.value.password) {
    newErrors.password = 'Password is required'
  } else if (form.value.password.length < 6) {
    newErrors.password = 'Password must be at least 6 characters'
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.value.password)) {
    newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  }

  // Confirm password validation
  if (!form.value.confirmPassword) {
    newErrors.confirmPassword = 'Please confirm your password'
  } else if (form.value.password !== form.value.confirmPassword) {
    newErrors.confirmPassword = 'Passwords do not match'
  }

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  try {
    isSubmitting.value = true
    await authStore.register(form.value)
    router.push('/chat')
  } catch (error) {
    // Error is handled by the auth store
    console.error('Registration failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const handleGoogleLogin = () => {
  window.location.href = '/api/auth/google'
}

const handleGithubLogin = () => {
  window.location.href = '/api/auth/github'
}

// Clear errors when form changes
const clearErrors = () => {
  errors.value = {}
  authStore.clearError()
}
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="elevation-8">
          <v-card-title class="text-center pa-6">
            <h1 class="text-h4 font-weight-bold text-primary">
              Broadcast Chat
            </h1>
            <p class="text-subtitle-1 mt-2">
              Create your account
            </p>
          </v-card-title>

          <v-card-text class="pa-6">
            <v-form @submit.prevent="handleSubmit" @input="clearErrors">
              <!-- Username Field -->
              <v-text-field
                v-model="form.username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.username || (authStore.error ? [authStore.error] : [])"
                required
                autofocus
                :disabled="isSubmitting"
                @input="clearErrors"
              />

              <!-- Email Field -->
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.email || (authStore.error ? [authStore.error] : [])"
                required
                :disabled="isSubmitting"
                @input="clearErrors"
              />

              <!-- Password Field -->
              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.password"
                required
                :disabled="isSubmitting"
                @input="clearErrors"
              />

              <!-- Confirm Password Field -->
              <v-text-field
                v-model="form.confirmPassword"
                label="Confirm Password"
                :type="showConfirmPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-check"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.confirmPassword"
                required
                :disabled="isSubmitting"
                @input="clearErrors"
              />

              <!-- Password Requirements -->
              <v-alert
                type="info"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <div class="text-caption">
                  Password must contain:
                  <ul class="mt-1 mb-0">
                    <li>At least 6 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                  </ul>
                </div>
              </v-alert>

              <!-- Submit Button -->
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="isSubmitting"
                :disabled="!isFormValid || isSubmitting"
                class="mb-4"
              >
                Create Account
              </v-btn>

              <!-- OAuth Divider -->
              <v-divider class="my-4">
                <span class="text-caption text-medium-emphasis">OR</span>
              </v-divider>

              <!-- OAuth Buttons -->
              <v-row class="mb-4">
                <v-col cols="6">
                  <v-btn
                    @click="handleGoogleLogin"
                    variant="outlined"
                    size="large"
                    block
                    :disabled="isSubmitting"
                    class="text-caption"
                  >
                    <v-icon start>mdi-google</v-icon>
                    Google
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn
                    @click="handleGithubLogin"
                    variant="outlined"
                    size="large"
                    block
                    :disabled="isSubmitting"
                    class="text-caption"
                  >
                    <v-icon start>mdi-github</v-icon>
                    GitHub
                  </v-btn>
                </v-col>
              </v-row>

              <!-- Links -->
              <div class="text-center">
                <router-link
                  to="/login"
                  class="text-primary text-decoration-none"
                >
                  Already have an account? Sign in
                </router-link>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  border-radius: 16px;
}

.v-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--v-theme-surface) 0%, var(--v-theme-surface-variant) 100%);
}
</style>