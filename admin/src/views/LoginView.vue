<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const discordLoginUrl = computed(() => {
  return window.__DISCORD_LOGIN_URL__ ?? '/admin/callback.php'
})

const errorMessage = computed(() => {
  const error = route.query.error as string | undefined
  if (!error) return null
  const errors: Record<string, string> = {
    invalid_code: 'Codigo de autorizacion invalido',
    no_access: 'No tienes permiso para acceder',
    discord_error: 'Error al conectar con Discord',
    session_expired: 'Sesion expirada, inicia sesion de nuevo',
    access_revoked: 'Acceso revocado',
  }
  return errors[error] ?? 'Error desconocido'
})
</script>

<template>
  <div class="min-h-screen bg-dark-900 flex items-center justify-center relative overflow-hidden">
    <!-- Animated background shapes -->
    <div class="bg-effects">
      <div class="bg-shape-1"></div>
      <div class="bg-shape-2"></div>
      <div class="bg-shape-3"></div>
    </div>

    <!-- Login card -->
    <div class="relative z-10 w-full max-w-md mx-4">
      <div class="glass-card p-10 relative overflow-hidden">
        <!-- Glow effect -->
        <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-magenta-500/5 pointer-events-none"></div>

        <div class="relative z-10 flex flex-col items-center">
          <!-- Logo -->
          <div class="w-16 h-16 gradient-primary rounded-xl flex items-center justify-center mb-6 shadow-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-white">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <!-- Title -->
          <h1 class="text-3xl font-display font-bold text-text-primary mb-1">
            FurrGuard
          </h1>
          <p class="text-text-secondary text-sm mb-8">
            Panel de Administracion
          </p>

          <!-- Discord login button -->
          <a
            :href="discordLoginUrl"
            class="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-discord hover:bg-discord-hover text-white rounded-xl font-medium text-sm transition-all hover:shadow-button hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Iniciar sesion con Discord
          </a>

          <!-- Error message -->
          <div
            v-if="errorMessage"
            class="w-full mt-5 p-3 rounded-lg bg-error-dim border border-red-500/20 text-red-400 text-sm text-center"
          >
            {{ errorMessage }}
          </div>

          <!-- Footer -->
          <p class="mt-6 text-text-muted text-xs">
            Solo usuarios autorizados
          </p>
        </div>
      </div>

      <!-- Version info -->
      <div class="text-center mt-6">
        <p class="text-text-tertiary text-xs">
          FurrGuard v1.5.0 &middot; SrTeb Limited
        </p>
      </div>
    </div>
  </div>
</template>
