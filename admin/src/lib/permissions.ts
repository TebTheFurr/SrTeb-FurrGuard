import type { Component } from 'vue'
import IconBuildings from '~icons/pixelarticons/buildings'
import IconCancel from '~icons/pixelarticons/cancel'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconDashboard from '~icons/pixelarticons/dashboard'
import IconEarth from '~icons/pixelarticons/earth'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconGlobe from '~icons/pixelarticons/globe'
import IconLock from '~icons/pixelarticons/lock'
import IconMap from '~icons/pixelarticons/map'
import IconMessageText from '~icons/pixelarticons/message-text'
import IconPlug from '~icons/pixelarticons/plug'
import IconArchive from '~icons/pixelarticons/archive'
import IconScriptText from '~icons/pixelarticons/script-text'
import IconSettings from '~icons/pixelarticons/settings-cog'
import IconShield from '~icons/pixelarticons/shield'
import IconUsers from '~icons/pixelarticons/users'
import { SECTIONS, type Section } from '@/api/types'

export interface NavItem {
  section: Section
  label: string
  icon: Component
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

/** Barra lateral. El nombre de cada ruta coincide con su sección. */
export const NAV: NavGroup[] = [
  { title: 'General', items: [{ section: 'overview', label: 'Resumen', icon: IconDashboard }] },
  {
    title: 'Jugadores',
    items: [
      { section: 'players', label: 'Jugadores', icon: IconGamepad },
      { section: 'connections', label: 'Conexiones', icon: IconPlug },
      { section: 'ips', label: 'IPs', icon: IconGlobe },
    ],
  },
  {
    title: 'Protección',
    items: [
      { section: 'whitelist', label: 'Whitelist', icon: IconChecklist },
      { section: 'blacklist', label: 'Blacklist', icon: IconCancel },
      { section: 'sanctions', label: 'Sanciones', icon: IconArchive },
    ],
  },
  {
    title: 'Filtros',
    items: [
      { section: 'providers', label: 'Proveedores', icon: IconBuildings },
      { section: 'countries', label: 'Países', icon: IconMap },
      { section: 'continents', label: 'Continentes', icon: IconEarth },
    ],
  },
  {
    title: 'Módulos',
    items: [
      { section: 'furrperms', label: 'FurrPerms', icon: IconLock },
      { section: 'furrsecurity', label: 'FurrSecurity', icon: IconShield },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { section: 'messages', label: 'Mensajes', icon: IconMessageText },
      { section: 'logs', label: 'Registro', icon: IconScriptText },
      { section: 'settings', label: 'Ajustes', icon: IconSettings },
      { section: 'users', label: 'Usuarios', icon: IconUsers },
    ],
  },
]

/** Solo las secciones que conoce el contrato (§4.3); cualquier otra (p. ej. `modules`) se ignora. */
export function sanitizeSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return []
  return SECTIONS.filter((section) => raw.includes(section))
}

export function navFor(permissions: readonly Section[]): NavGroup[] {
  return NAV.map((group) => ({ ...group, items: group.items.filter((item) => permissions.includes(item.section)) }))
    .filter((group) => group.items.length > 0)
}

export function firstSection(permissions: readonly Section[]): Section | null {
  return navFor(permissions)[0]?.items[0]?.section ?? null
}

const NAV_BY_SECTION = new Map(NAV.flatMap((group) => group.items.map((item) => [item.section, item] as const)))

export const sectionIcon = (section: Section): Component => NAV_BY_SECTION.get(section)?.icon ?? IconDashboard
