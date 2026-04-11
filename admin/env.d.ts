/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare const __APP_VERSION__: string

interface Window {
  __FURRGUARD_USER__?: {
    discord_id: string
    username: string
    avatar: string | null
    role: 'founder' | 'owner' | 'manager' | 'sradmin' | 'admin'
    session_token: string
    expires_at: string
  }
  __ROLE_PERMISSIONS__?: Record<string, string[]>
  __DISCORD_LOGIN_URL__?: string
}
