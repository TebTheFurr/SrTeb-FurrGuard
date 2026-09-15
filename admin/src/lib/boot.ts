import { ROLES, type Boot, type Role, type SessionUser } from '@/api/types'
import { sanitizeSections } from './permissions'

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

function readUser(raw: unknown): SessionUser | null {
  if (typeof raw !== 'object' || raw === null) return null
  const user = raw as Record<string, unknown>
  const role = ROLES.find((r) => r === user.role) as Role | undefined
  if (!role || !text(user.discord_id)) return null
  return {
    discord_id: text(user.discord_id),
    username: text(user.username) || text(user.discord_id),
    avatar: text(user.avatar) || null,
    role,
  }
}

/** Valida `window.__FURRGUARD__` (§4.1): nada de lo que no encaje llega al resto del SPA. */
export function readBoot(raw: unknown = globalThis.window?.__FURRGUARD__): Boot {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const user = readUser(source.user)
  return {
    version: text(source.version),
    csrfToken: text(source.csrfToken),
    loginUrl: text(source.loginUrl),
    loginError: text(source.loginError) || null,
    user,
    permissions: user ? sanitizeSections(source.permissions) : [],
    canSeeIps: user !== null && source.canSeeIps === true,
  }
}
