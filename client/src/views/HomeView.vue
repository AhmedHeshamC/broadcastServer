<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const goToChat = () => {
  router.push('/chat')
}

const goToLogin = () => {
  router.push('/login')
}

const goToRegister = () => {
  router.push('/register')
}
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="elevation-8 text-center">
          <v-card-title class="pa-6">
            <v-icon size="64" color="primary" class="mb-4">
              mdi-broadcast
            </v-icon>
            <h1 class="text-h4 font-weight-bold text-primary">
              Broadcast Chat
            </h1>
          </v-card-title>

          <v-card-text class="pa-6">
            <p class="text-h6 mb-6">
              Welcome to the real-time messaging platform
            </p>

            <div v-if="authStore.isAuthenticated">
              <v-btn
                color="primary"
                size="large"
                block
                @click="goToChat"
                class="mb-4"
              >
                Enter Chat
              </v-btn>
            </div>

            <div v-else>
              <v-btn
                color="primary"
                size="large"
                block
                @click="goToLogin"
                class="mb-3"
              >
                Sign In
              </v-btn>

              <v-btn
                variant="outlined"
                size="large"
                block
                @click="goToRegister"
              >
                Create Account
              </v-btn>
            </div>
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