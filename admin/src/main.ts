import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Initialize auth from PHP-injected globals
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
auth.initialize()

app.mount('#app')
