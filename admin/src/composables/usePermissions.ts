import { useAuthStore } from '@/stores/auth'
import { ROLE_HIERARCHY, type Role } from '@/lib/constants'

export function usePermissions() {
  const auth = useAuthStore()

  function can(section: string): boolean {
    if (!auth.user) return false
    const perms = auth.permissions[auth.user.role] || []
    return (
      perms.includes(section) ||
      (perms.includes('modules') &&
        ['furrperms', 'furrsecurity'].includes(section))
    )
  }

  function isFounder(): boolean {
    return auth.user?.role === 'founder'
  }

  function minRole(role: Role): boolean {
    if (!auth.user) return false
    return ROLE_HIERARCHY.indexOf(auth.user.role) >= ROLE_HIERARCHY.indexOf(role)
  }

  return { can, isFounder, minRole }
}
