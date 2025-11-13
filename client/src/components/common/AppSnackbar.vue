<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()

const snackbar = ref({
  show: false,
  message: '',
  color: 'info' as 'success' | 'error' | 'warning' | 'info'
})

// Watch for auth store errors
const authError = computed(() => authStore.error)
const connectionError = computed(() => chatStore.connectionError)
const isConnected = computed(() => chatStore.isConnected)

// Show auth errors
const showAuthError = (error: string | null) => {
  if (error) {
    snackbar.value = {
      show: true,
      message: error,
      color: 'error'
    }
  }
}

// Show connection status changes
const showConnectionStatus = (connected: boolean, error: string | null) => {
  if (error) {
    snackbar.value = {
      show: true,
      message: `Connection error: ${error}`,
      color: 'error'
    }
  } else if (connected) {
    snackbar.value = {
      show: true,
      message: 'Connected to chat server',
      color: 'success'
    }
  }
}

// Watch for changes
const unwatchAuthError = computed(() => {
  if (authError.value) {
    showAuthError(authError.value)
  }
})

const unwatchConnectionError = computed(() => {
  if (connectionError.value) {
    showConnectionStatus(false, connectionError.value)
  }
})

const unwatchConnectionStatus = computed(() => {
  if (isConnected.value) {
    showConnectionStatus(true, null)
  }
})
</script>

<template>
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    :timeout="3000"
    location="bottom"
  >
    <div class="d-flex align-center">
      <v-icon
        :icon="snackbar.color === 'success' ? 'mdi-check-circle' :
               snackbar.color === 'error' ? 'mdi-alert-circle' :
               snackbar.color === 'warning' ? 'mdi-alert' :
               'mdi-information'"
        class="mr-2"
      />
      {{ snackbar.message }}
    </div>

    <template #actions>
      <v-btn
        variant="text"
        @click="snackbar.show = false"
      >
        Close
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.v-snackbar {
  bottom: 20px;
}
</style>