/// <reference types="vite/client" />

/** Lo que admin/index.php inyecta antes de cargar el SPA (docs/API.md §4.1). */
interface FurrGuardBoot {
  version: string
  csrfToken: string
  loginUrl: string
  loginError: string | null
  user: null | {
    discord_id: string
    username: string
    avatar: string | null
    role: 'founder' | 'owner' | 'manager' | 'sradmin' | 'admin'
  }
  permissions: string[]
  canSeeIps: boolean
}

interface Window {
  __FURRGUARD__?: FurrGuardBoot
}
