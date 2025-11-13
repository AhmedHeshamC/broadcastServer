<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import AppAppBar from '@/components/layout/AppAppBar.vue'
import AppSnackbar from '@/components/common/AppSnackbar.vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

console.log('🏗️ App.vue: Script setup starting...')

const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

console.log('📊 App.vue: Stores initialized')
console.log('🛣️ App.vue: Current route:', route.name, route.path)

// Watch for route changes to handle WebSocket connection
watch(
  () => route.name,
  (newRoute) => {
    if (newRoute === 'chat' && authStore.isAuthenticated && !chatStore.isConnected) {
      chatStore.connect()
    } else if (newRoute !== 'chat' && chatStore.isConnected) {
      chatStore.disconnect()
    }
  },
  { immediate: true }
)

// Initialize app
onMounted(async () => {
  console.log('🎯 App.vue: onMounted lifecycle hook called')

  // Check for existing authentication
  if (authStore.token) {
    console.log('🔑 App.vue: Found existing token, validating...')
    try {
      await authStore.getCurrentUser()
      console.log('✅ App.vue: User authenticated successfully')
    } catch (error) {
      console.log('❌ App.vue: Token invalid, logging out:', error)
      // Token is invalid, clear it
      authStore.logout()
    }
  } else {
    console.log('🔓 App.vue: No existing token found')
  }

  console.log('🎉 App.vue: App initialization complete')
})

onUnmounted(() => {
  chatStore.disconnect()
})
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <AppAppBar />

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-0">
        <router-view />
      </v-container>
    </v-main>

    <!-- Connection Status (visible on chat page) -->
    <ConnectionStatus v-if="$route.name === 'chat'" />

    <!-- Global Snackbar -->
    <AppSnackbar />
  </v-app>
</template>

<style scoped>
.v-main {
  background-color: var(--v-theme-surface);
}
</style>
