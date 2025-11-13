<template>
  <div class="oauth-callback-container">
    <v-card
      class="oauth-callback-card mx-auto pa-6"
      :max-width="400"
      elevation="8"
    >
      <div class="text-center">
        <v-icon
          :icon="statusIcon"
          :color="statusColor"
          size="64"
          class="mb-4"
        />

        <v-card-title class="text-h5 mb-2">
          {{ statusTitle }}
        </v-card-title>

        <v-card-text>
          {{ statusMessage }}
        </v-card-text>

        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
          class="mb-4"
        />

        <v-btn
          v-if="!loading && redirectPath"
          :to="redirectPath"
          color="primary"
          variant="elevated"
          class="mt-4"
        >
          Continue to Chat
        </v-btn>

        <v-btn
          v-if="error"
          to="/login"
          color="secondary"
          variant="outlined"
          class="mt-4"
        >
          Back to Login
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref(false)
const success = ref(false)

const statusIcon = computed(() => {
  if (loading.value) return 'mdi-loading'
  if (error.value) return 'mdi-alert-circle-outline'
  return 'mdi-check-circle-outline'
})

const statusColor = computed(() => {
  if (loading.value) return 'primary'
  if (error.value) return 'error'
  return 'success'
})

const statusTitle = computed(() => {
  if (loading.value) return 'Processing Login...'
  if (error.value) return 'Login Failed'
  return 'Login Successful!'
})

const statusMessage = computed(() => {
  if (loading.value) return 'Please wait while we process your authentication.'
  if (error.value) return 'There was an error processing your login. Please try again.'
  return 'You have been successfully authenticated!'
})

const redirectPath = computed(() => {
  if (success.value) {
    return route.query.redirect as string || '/chat'
  }
  return null
})

onMounted(async () => {
  try {
    // Check if OAuth callback was successful
    const successParam = route.query.success
    const userParam = route.query.user
    const tokensParam = route.query.tokens

    if (successParam === 'true' && userParam && tokensParam) {
      // Parse user and tokens from URL parameters
      const user = JSON.parse(decodeURIComponent(userParam as string))
      const tokens = JSON.parse(decodeURIComponent(tokensParam as string))

      // Store authentication data
      authStore.setTokens(tokens.accessToken, tokens.refreshToken)
      // Use the user ref directly since _user is exposed as the raw ref
      if (authStore._user) {
        authStore._user.value = user
      }
      success.value = true

      // Clear URL parameters
      await router.replace({
        path: route.path,
        query: {}
      })
    } else {
      // Handle OAuth failure
      error.value = true
    }
  } catch (err) {
    console.error('OAuth callback error:', err)
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.oauth-callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.oauth-callback-card {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.v-icon.mdi-loading {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>