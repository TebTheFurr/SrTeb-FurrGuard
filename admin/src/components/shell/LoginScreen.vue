<script setup lang="ts">
import FgFooter from '@shared/ui/components/FgFooter.vue'
import { computed, onMounted } from 'vue'
import IconAlert from '~icons/pixelarticons/alert'
import IconDiscord from '~icons/pixelarticons/discord'
import IconWarningBox from '~icons/pixelarticons/warning-box'
import { useSession } from '@/stores/session'

const LOGIN_ERRORS: Record<string, string> = {
  invalid_code: 'Discord devolvió un código no válido. Vuelve a intentarlo.',
  invalid_state: 'La petición de inicio de sesión no es válida o ha caducado. Vuelve a intentarlo.',
  discord_error: 'Discord no respondió correctamente. Inténtalo de nuevo en unos minutos.',
  no_access: 'Tu cuenta de Discord no tiene acceso al panel. Pide acceso a un founder.',
  session_expired: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  access_revoked: 'Tu acceso al panel ha sido revocado.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.',
}

const session = useSession()

/** Solo enlaces https o rutas del propio sitio: nunca un `javascript:` inyectado. */
const loginUrl = computed(() => {
  const url = session.boot?.loginUrl ?? ''
  return /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : null
})

const notice = computed(() => {
  if (session.sessionClosed) return { tone: 'warn', icon: IconAlert, text: 'Tu sesión se ha cerrado. Vuelve a entrar para continuar.' }
  const code = session.boot?.loginError
  if (code) return { tone: 'down', icon: IconWarningBox, text: LOGIN_ERRORS[code] ?? 'No se pudo iniciar sesión.' }
  return null
})

/** Con la sesión cerrada se recarga /admin/ para que el servidor genere un enlace de Discord nuevo. */
function reenter(): void {
  window.location.assign(import.meta.env.BASE_URL)
}

onMounted(() => {
  document.title = 'Iniciar sesión · FurrGuard'
})
</script>

<template>
  <div class="acceso">
    <main class="acceso-centro">
      <div class="acceso-tarjeta">
        <img src="@shared/ui/img/furrguard-256.webp" width="96" height="96" alt="">
        <h1>Furr<span>Guard</span></h1>
        <span class="label">Panel de administración</span>
        <p>Anti-VPN, whitelist, blacklist y verificación de staff de la red. Entra con tu cuenta de Discord autorizada.</p>
        <div v-if="notice" class="aviso" :class="notice.tone" role="alert">
          <component :is="notice.icon" aria-hidden="true" />
          <span class="texto">{{ notice.text }}</span>
        </div>
        <button v-if="session.sessionClosed" type="button" class="btn-discord" @click="reenter">
          <IconDiscord aria-hidden="true" /> Volver a entrar
        </button>
        <a v-else-if="loginUrl" class="btn-discord" :href="loginUrl">
          <IconDiscord aria-hidden="true" /> Entrar con Discord
        </a>
        <div v-else class="aviso down" role="alert">
          <IconWarningBox aria-hidden="true" />
          <span class="texto">El inicio de sesión no está configurado en el servidor.</span>
        </div>
      </div>
    </main>
    <div class="pie-marco"><FgFooter compact /></div>
  </div>
</template>

<style scoped>
.btn-discord svg.pi { width: 24px; height: 24px; }
</style>
