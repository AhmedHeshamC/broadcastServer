<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()

const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}

const isDark = computed(() => theme.global.current.value.dark)
</script>

<template>
  <v-btn
    :icon="isDark ? 'mdi-brightness-7' : 'mdi-brightness-4'"
    variant="text"
    @click="toggleTheme"
  >
    <v-tooltip activator="parent">
      Toggle {{ isDark ? 'light' : 'dark' }} mode
    </v-tooltip>
  </v-btn>
</template>

<style scoped>
.v-btn {
  transition: transform 0.2s ease;
}

.v-btn:hover {
  transform: scale(1.1);
}
</style>