<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import ResponsiveLayout from '@/components/layout/ResponsiveLayout.vue'

const chatStore = useChatStore()

const newMessage = ref('')
const messagesContainer = ref<HTMLElement>()

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const sendMessage = () => {
  if (newMessage.value.trim()) {
    chatStore.sendMessage(newMessage.value.trim())
    newMessage.value = ''
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// Watch for new messages and scroll to bottom
watch(
  () => chatStore.messages,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(async () => {
  if (!chatStore.isConnected) {
    chatStore.connect()
  }

  // Load message history
  try {
    await chatStore.loadMessageHistory()
    scrollToBottom()
  } catch (error) {
    console.error('Failed to load message history:', error)
  }
})
</script>

<template>
  <ResponsiveLayout>
    <template #title>
      <div class="d-flex align-center">
        <v-icon start>mdi-message</v-icon>
        Chat Room
        <v-spacer />
        <v-chip
          :color="chatStore.isConnected ? 'success' : 'error'"
          variant="flat"
          size="small"
          class="ml-2"
        >
          <v-icon start>
            {{ chatStore.isConnected ? 'mdi-wifi' : 'mdi-wifi-off' }}
          </v-icon>
          <span class="d-none d-sm-inline">
            {{ chatStore.isConnected ? 'Connected' : 'Disconnected' }}
          </span>
        </v-chip>
      </div>
    </template>

    <!-- Chat Area -->
    <v-card class="fill-height d-flex flex-column" elevation="2">
      <!-- Messages Container -->
      <v-card-text
        ref="messagesContainer"
        class="flex-grow-1 overflow-y-auto pa-4"
        style="max-height: calc(100vh - 280px); min-height: 400px;"
      >
        <div v-if="chatStore.messages.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">
            mdi-message-outline
          </v-icon>
          <p class="text-h6 text-grey-darken-1">
            No messages yet. Start the conversation!
          </p>
        </div>

        <div v-else>
          <div
            v-for="message in chatStore.messages"
            :key="message._id || `${message.timestamp}-${message.content}`"
            class="mb-3"
          >
            <!-- System Messages -->
            <div v-if="message.type === 'system'" class="text-center">
              <v-chip
                color="info"
                variant="tonal"
                size="small"
                class="text-caption"
              >
                {{ message.content }}
              </v-chip>
            </div>

            <!-- User Joined/Left Messages -->
            <div v-else-if="message.type === 'user_joined'" class="text-center">
              <v-chip
                color="success"
                variant="tonal"
                size="small"
                class="text-caption"
              >
                <v-icon start>mdi-account-plus</v-icon>
                {{ message.username }} joined the chat
              </v-chip>
            </div>

            <div v-else-if="message.type === 'user_left'" class="text-center">
              <v-chip
                color="warning"
                variant="tonal"
                size="small"
                class="text-caption"
              >
                <v-icon start>mdi-account-minus</v-icon>
                {{ message.username }} left the chat
              </v-chip>
            </div>

            <!-- Regular Messages -->
            <div v-else class="d-flex align-start">
              <v-avatar
                size="32"
                color="primary"
                class="mr-3 flex-shrink-0"
              >
                <v-icon>mdi-account</v-icon>
              </v-avatar>

              <div class="flex-grow-1">
                <div class="d-flex align-center mb-1 flex-wrap">
                  <span class="font-weight-medium text-primary mr-2">
                    {{ message.senderName || message.username || 'Unknown' }}
                  </span>
                  <span class="text-caption text-medium-emphasis">
                    {{ new Date(message.timestamp).toLocaleTimeString() }}
                  </span>
                </div>

                <v-card
                  variant="tonal"
                  class="inline-block pa-2"
                  max-width="100%"
                >
                  <p class="ma-0 text-body-2 word-wrap">
                    {{ message.content }}
                  </p>
                </v-card>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <!-- Message Input -->
      <v-card-actions class="pa-4 border-t">
        <v-text-field
          v-model="newMessage"
          label="Type a message..."
          variant="outlined"
          prepend-inner-icon="mdi-message"
          append-inner-icon="mdi-send"
          @click:append-inner="sendMessage"
          @keypress="handleKeyPress"
          :disabled="!chatStore.isConnected"
          hide-details
          density="compact"
        />
      </v-card-actions>
    </v-card>

    <!-- Users Sidebar -->
    <template #sidebar>
      <v-card elevation="2" class="mb-4">
        <v-card-title class="bg-surface-variant text-subtitle-1">
          <v-icon start>mdi-account-group</v-icon>
          Users ({{ chatStore.connectedUsers.length }})
        </v-card-title>

        <v-card-text class="pa-0">
          <v-list density="compact">
            <v-list-item v-if="chatStore.connectedUsers.length === 0">
              <v-list-item-title class="text-medium-emphasis text-center">
                No users connected
              </v-list-item-title>
            </v-list-item>

            <v-list-item
              v-for="user in chatStore.connectedUsers"
              :key="user.id"
            >
              <template #prepend>
                <v-avatar size="24" color="primary">
                  <v-icon size="16">mdi-account</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="text-body-2">
                {{ user.username }}
                <v-chip
                  v-if="user.role === 'admin'"
                  color="warning"
                  variant="flat"
                  size="x-small"
                  class="ml-1"
                >
                  <v-icon start size="x-small">mdi-shield-account</v-icon>
                </v-chip>
              </v-list-item-title>

              <template #append>
                <v-icon size="12" color="success">
                  mdi-circle
                </v-icon>
              </template>
            </v-list-item>
          </v-list>

          <!-- Typing Users -->
          <v-divider v-if="chatStore.typingUsers.length > 0" />

          <v-list v-if="chatStore.typingUsers.length > 0" density="compact">
            <v-list-item>
              <v-list-item-title class="text-caption text-medium-emphasis">
                <v-icon size="small" start>mdi-dots-horizontal</v-icon>
                {{ chatStore.typingUsers.map(u => u.username).join(', ') }}
                {{ chatStore.typingUsers.length === 1 ? 'is' : 'are' }} typing...
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </template>
  </ResponsiveLayout>
</template>

<style scoped>
.inline-block {
  display: inline-block;
  word-wrap: break-word;
}

.word-wrap {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .v-card-text {
    padding: 12px 8px;
  }
}

@media (max-width: 960px) {
  .v-card-text {
    max-height: calc(100vh - 240px) !important;
  }
}
</style>