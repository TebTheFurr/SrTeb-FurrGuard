import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import '@shared/ui/components.css'
import '@shared/ui/layout.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { configureApi } from './api/client'
import { readBoot } from './lib/boot'
import { toast } from './lib/toast'
import { createAppRouter } from './router'
import { useSession } from './stores/session'

const CSRF_RELOAD_KEY = 'furrguard.csrfReloadAt'

const boot = readBoot()
const pinia = createPinia()
const app = createApp(App).use(pinia)
const session = useSession(pinia)
session.start(boot)

/** Recarga una sola vez por minuto: si el servidor rechaza siempre el token, no entramos en bucle. */
function reloadForCsrf(message: string): void {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(CSRF_RELOAD_KEY)) || 0
    sessionStorage.setItem(CSRF_RELOAD_KEY, String(Date.now()))
  } catch {
    last = Date.now()
  }
  if (Date.now() - last < 60_000) {
    toast(`${message} Recarga la página manualmente o vuelve a iniciar sesión.`, 'error')
    return
  }
  toast(`${message} Recargando el panel…`, 'warn')
  setTimeout(() => window.location.reload(), 1800)
}

configureApi({
  csrfToken: boot.csrfToken,
  hooks: {
    unauthorized: () => session.closeSession(),
    csrf: (error) => reloadForCsrf(error.message),
  },
})

// El router solo existe con sesión: la pantalla de acceso no descarga ninguna vista del panel
if (boot.user) app.use(createAppRouter(session))

app.mount('#app')
