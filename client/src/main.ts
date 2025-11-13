import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import vuetify from './plugins/vuetify'
import App from './App.vue'

// Debug logging
console.log('🚀 Main.ts: Starting Vue app initialization...')

// Styles
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@/styles/responsive.css'

console.log('📦 Main.ts: All imports loaded successfully')

try {
  const app = createApp(App)
  console.log('✅ Main.ts: Vue app created successfully')

  app.use(createPinia())
  console.log('✅ Main.ts: Pinia plugin added')

  app.use(router)
  console.log('✅ Main.ts: Router plugin added')

  app.use(vuetify)
  console.log('✅ Main.ts: Vuetify plugin added')

  app.mount('#app')
  console.log('🎉 Main.ts: Vue app mounted successfully!')
} catch (error) {
  console.error('❌ Main.ts: Error during app initialization:', error)
}
