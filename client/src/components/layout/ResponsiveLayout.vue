<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { computed } from 'vue'

const display = useDisplay()

const isMobile = computed(() => display.xs.value)
const isTablet = computed(() => display.sm.value || display.md.value)
const isDesktop = computed(() => display.lgAndUp.value)

defineProps<{
  title?: string
  showBreadcrumb?: boolean
}>()

defineSlots<{
  default(): any
  title(): any
  actions(): any
  sidebar(): any
}>()
</script>

<template>
  <div class="responsive-layout">
    <!-- Header -->
    <div v-if="$slots.title || $slots.actions" class="responsive-header mb-4">
      <v-row align="center" no-gutters>
        <v-col :cols="$slots.actions ? 8 : 12" :md="$slots.actions ? 10 : 12">
          <slot name="title">
            <h1 v-if="title" class="text-h4 text-md-h3 font-weight-bold">
              {{ title }}
            </h1>
          </slot>
        </v-col>
        <v-col v-if="$slots.actions" :cols="4" :md="2" class="text-right">
          <slot name="actions" />
        </v-col>
      </v-row>
    </div>

    <!-- Main Content with Sidebar -->
    <v-row no-gutters>
      <!-- Sidebar (hidden on mobile) -->
      <v-col
        v-if="$slots.sidebar"
        cols="12"
        md="3"
        lg="2"
        :order="isMobile ? 2 : 1"
        class="pr-md-4"
      >
        <div class="sidebar-sticky">
          <slot name="sidebar" />
        </div>
      </v-col>

      <!-- Main Content -->
      <v-col
        cols="12"
        :md="$slots.sidebar ? 9 : 12"
        :lg="$slots.sidebar ? 10 : 12"
        :order="isMobile ? 1 : 2"
      >
        <slot />
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.responsive-layout {
  width: 100%;
  max-width: 100%;
}

.responsive-header {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  padding-bottom: 16px;
}

.sidebar-sticky {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

@media (max-width: 960px) {
  .sidebar-sticky {
    position: static;
    max-height: none;
    margin-bottom: 16px;
  }
}

@media (max-width: 600px) {
  .responsive-header .text-right {
    text-align: left !important;
    margin-top: 8px;
  }
}
</style>