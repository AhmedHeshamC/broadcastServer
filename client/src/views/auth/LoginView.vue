<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest } from '@/types/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = ref<LoginRequest>({
  email: '',
  password: ''
})

const showPassword = ref(false)
const isSubmitting = ref(false)

const isFormValid = computed(() => {
  return form.value.email && form.value.password && form.value.password.length >= 6
})

const handleSubmit = async () => {
  if (!isFormValid.value) return

  try {
    isSubmitting.value = true
    await authStore.login(form.value)

    // Redirect to intended page or chat
    const redirect = route.query.redirect as string || '/chat'
    router.push(redirect)
  } catch (error) {
    // Error is handled by the auth store
    console.error('Login failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const handleGoogleLogin = () => {
  window.location.href = authStore.getGoogleAuthUrl?.() || '/api/auth/google'
}

const handleGithubLogin = () => {
  window.location.href = authStore.getGithubAuthUrl?.() || '/api/auth/github'
}

// Clear errors when form changes
const clearErrors = () => {
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
              Sign in to your account
            </p>
          </v-card-title>

          <v-card-text class="pa-6">
            <v-form @submit.prevent="handleSubmit" @input="clearErrors">
              <!-- Email Field -->
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                variant="outlined"
                class="mb-4"
                :error-messages="authStore.error ? [authStore.error] : []"
                required
                autofocus
                :disabled="isSubmitting"
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
                :error-messages="authStore.error ? [authStore.error] : []"
                required
                :disabled="isSubmitting"
              />

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
                Sign In
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
                  to="/register"
                  class="text-primary text-decoration-none"
                >
                  Don't have an account? Sign up
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