/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Window {
  __FURRGUARD_VERSION__?: string
  __VERIFY_DATA__?: {
    state: 'form' | 'error' | 'success'
    minecraft_nick?: string
    discord_login_url?: string
    expires_at?: string
    title?: string
    message?: string
  }
}
