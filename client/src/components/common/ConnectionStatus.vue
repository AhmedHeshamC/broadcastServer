<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

const isConnected = computed(() => chatStore.isConnected)
const connectedUsers = computed(() => chatStore.connectedUsers)
const yourUsername = computed(() => chatStore.yourUsername)

const connectionStatus = computed(() => {
  if (isConnected.value) {
    return {
      color: 'success',
      text: 'Connected',
      icon: 'mdi-wifi'
    }
  } else {
    return {
      color: 'error',
      text: 'Disconnected',
      icon: 'mdi-wifi-off'
    }
  }
})
</script>

<template>
  <v-card
    class="connection-status"
    elevation="2"
    color="surface"
  >
    <v-card-text class="pa-3">
      <div class="d-flex align-center justify-space-between">
        <!-- Connection Status -->
        <div class="d-flex align-center">
          <v-icon
            :icon="connectionStatus.icon"
            :color="connectionStatus.color"
            class="mr-2"
          />
          <span class="text-caption">
            {{ connectionStatus.text }}
          </span>
        </div>

        <!-- User Info and Connected Users -->
        <div v-if="isConnected" class="d-flex align-center ga-4">
          <!-- Your Username -->
          <v-chip
            v-if="yourUsername"
            color="primary"
            variant="flat"
            size="x-small"
          >
            <v-icon start>mdi-account</v-icon>
            {{ yourUsername }}
          </v-chip>

          <!-- Connected Users Count -->
          <v-chip
            color="success"
            variant="flat"
            size="x-small"
          >
            <v-icon start>mdi-account-group</v-icon>
            {{ connectedUsers.length }} online
          </v-chip>
        </div>
      </div>

      <!-- Connected Users List (shown when there are users) -->
      <div v-if="isConnected && connectedUsers.length > 0" class="mt-2">
        <v-divider class="mb-2" />
        <div class="text-caption text-medium-emphasis mb-1">
          Connected Users:
        </div>
        <div class="d-flex flex-wrap gap-1">
          <v-chip
            v-for="user in connectedUsers.slice(0, 10)"
            :key="user.id"
            variant="outlined"
            size="x-small"
            :color="user.role === 'admin' ? 'warning' : 'default'"
          >
            {{ user.username }}
            <v-icon
              v-if="user.role === 'admin'"
              start
              size="x-small"
            >
              mdi-shield-account
            </v-icon>
          </v-chip>
          <span
            v-if="connectedUsers.length > 10"
            class="text-caption text-medium-emphasis align-self-center"
          >
            +{{ connectedUsers.length - 10 }} more
          </span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.connection-status {
  position: fixed;
  bottom: 20px;
  left: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 600px;
  margin: 0 auto;
  border-radius: 12px;
  backdrop-filter: blur(8px);
  background-color: rgba(var(--v-theme-surface), 0.9);
}

@media (max-width: 600px) {
  .connection-status {
    bottom: 10px;
    left: 10px;
    right: 10px;
  }
}
</style>