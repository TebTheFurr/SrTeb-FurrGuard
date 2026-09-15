import { describe, expect, it } from 'vitest'
import type { Section } from '@/api/types'
import { readBoot } from './boot'
import { healthTone } from './format'
import { firstSection, navFor, sanitizeSections } from './permissions'

/** Tabla de roles de docs/API.md §4.3. */
const ROLE_SECTIONS: Record<string, Section[]> = {
  founder: ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions', 'providers', 'countries',
    'continents', 'messages', 'logs', 'settings', 'users', 'furrperms', 'furrsecurity'],
  owner: ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions', 'countries', 'continents',
    'messages', 'logs', 'furrperms', 'furrsecurity'],
  manager: ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions'],
  admin: ['overview', 'players', 'whitelist', 'blacklist', 'sanctions'],
}

const navSections = (sections: Section[]): string[] => navFor(sections).flatMap((g) => g.items.map((i) => i.section))

describe('permisos y navegación', () => {
  it('la barra lateral muestra exactamente las secciones del rol', () => {
    for (const sections of Object.values(ROLE_SECTIONS)) {
      expect(navSections(sections).sort()).toEqual([...sections].sort())
    }
  })

  it('un admin no ve FurrPerms, FurrSecurity, conexiones ni ajustes', () => {
    const visible = navSections(ROLE_SECTIONS.admin!)
    for (const hidden of ['furrperms', 'furrsecurity', 'connections', 'ips', 'settings', 'users', 'providers']) {
      expect(visible).not.toContain(hidden)
    }
  })

  it('descarta secciones que no existen en el contrato (p. ej. modules)', () => {
    expect(sanitizeSections(['overview', 'modules', 'players', 42, null])).toEqual(['overview', 'players'])
    expect(sanitizeSections('overview')).toEqual([])
  })

  it('no deja grupos vacíos y elige la primera sección disponible', () => {
    expect(navFor(['whitelist']).map((g) => g.title)).toEqual(['Protección'])
    expect(firstSection(['sanctions', 'whitelist'])).toBe('whitelist')
    expect(firstSection([])).toBeNull()
  })
})

describe('arranque (window.__FURRGUARD__)', () => {
  it('sin usuario no hay permisos ni IPs aunque lleguen', () => {
    const boot = readBoot({ csrfToken: 't', loginUrl: 'https://discord.com/x', user: null, permissions: ['overview'], canSeeIps: true })
    expect(boot.user).toBeNull()
    expect(boot.permissions).toEqual([])
    expect(boot.canSeeIps).toBe(false)
  })

  it('rechaza roles desconocidos y normaliza tipos', () => {
    expect(readBoot({ user: { discord_id: '1', username: 'x', role: 'god' } }).user).toBeNull()
    const boot = readBoot({
      version: '2.0.0', user: { discord_id: '123456789012345678', username: 'Teb', avatar: null, role: 'owner' },
      permissions: ['overview', 'modules'], canSeeIps: 'true', loginError: '',
    })
    expect(boot.user?.role).toBe('owner')
    expect(boot.permissions).toEqual(['overview'])
    expect(boot.canSeeIps).toBe(false)
    expect(boot.loginError).toBeNull()
  })

  it('tolera que no haya objeto de arranque', () => {
    expect(readBoot(undefined)).toMatchObject({ user: null, permissions: [], csrfToken: '' })
  })
})

describe('línea de pulso', () => {
  const ok = { api_key_configured: true, geo_mirror: 'ok', ip_api: 'ok' } as const

  it('ok, warn y down según health', () => {
    expect(healthTone(ok)).toBe('ok')
    expect(healthTone({ ...ok, geo_mirror: 'disabled' })).toBe('ok')
    expect(healthTone({ ...ok, ip_api: 'limited' })).toBe('warn')
    expect(healthTone({ ...ok, geo_mirror: 'missing' })).toBe('warn')
    expect(healthTone({ ...ok, ip_api: 'down' })).toBe('warn')
    expect(healthTone({ ...ok, ip_api: 'down', geo_mirror: 'missing' })).toBe('down')
    expect(healthTone({ ...ok, api_key_configured: false })).toBe('down')
  })
})
