<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)

const menuItems = computed(() => {
  if (!isAuthenticated.value) return []

  const items = [
    { title: 'Chat', icon: 'mdi-message', path: '/chat' },
    { title: 'Profile', icon: 'mdi-account', path: '/profile' }
  ]

  if (isAdmin.value) {
    items.push({ title: 'Admin', icon: 'mdi-shield-account', path: '/admin' })
  }

  return items
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const navigateTo = (path: string) => {
  router.push(path)
}
</script>

<template>
  <v-app-bar elevation="2" color="primary">
    <!-- Title and Logo -->
    <v-app-bar-title>
      <router-link to="/" class="text-decoration-none text-white">
        <v-icon start>mdi-broadcast</v-icon>
        Broadcast Chat
      </router-link>
    </v-app-bar-title>

    <v-spacer />

    <!-- Theme Toggle -->
    <ThemeToggle />

    <!-- Navigation for authenticated users -->
    <template v-if="isAuthenticated">
      <!-- Desktop Navigation -->
      <div class="d-none d-md-flex">
        <v-btn
          v-for="item in menuItems"
          :key="item.path"
          :variant="route.path === item.path ? 'flat' : 'text'"
          :color="route.path === item.path ? 'white' : undefined"
          class="mr-2"
          @click="navigateTo(item.path)"
        >
          <v-icon start>{{ item.icon }}</v-icon>
          {{ item.title }}
        </v-btn>
      </div>

      <!-- User Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="text"
            color="white"
            class="ml-2"
          >
            <v-icon start>mdi-account-circle</v-icon>
            {{ user?.username }}
            <v-icon end>mdi-menu-down</v-icon>
          </v-btn>
        </template>

        <v-list>
          <!-- Mobile Navigation -->
          <template v-if="$vuetify.display.mobile">
            <v-list-item
              v-for="item in menuItems"
              :key="item.path"
              :prepend-icon="item.icon"
              :title="item.title"
              @click="navigateTo(item.path)"
            />
            <v-divider />
          </template>

          <!-- User Info -->
          <v-list-item>
            <v-list-item-title class="text-caption">
              {{ user?.email }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              Role: {{ user?.role }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-divider />

          <!-- Logout -->
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            @click="handleLogout"
          />
        </v-list>
      </v-menu>
    </template>

    <!-- Navigation for guests -->
    <template v-else>
      <v-btn
        variant="text"
        color="white"
        to="/login"
        class="mr-2"
      >
        Sign In
      </v-btn>
      <v-btn
        variant="flat"
        color="white"
        to="/register"
      >
        Sign Up
      </v-btn>
    </template>
  </v-app-bar>
</template>

<style scoped>
.text-white {
  color: white !important;
}
</style>