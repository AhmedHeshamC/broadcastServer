<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" class="text-center">
        <v-icon size="120" color="primary" class="mb-4">
          mdi-help-circle-outline
        </v-icon>

        <h1 class="text-h2 font-weight-bold mb-4">
          404
        </h1>

        <h2 class="text-h5 mb-6">
          Page Not Found
        </h2>

        <p class="text-body-1 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <v-btn
          color="primary"
          size="large"
          @click="goHome"
        >
          Go Home
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--v-theme-surface) 0%, var(--v-theme-surface-variant) 100%);
}
</style>