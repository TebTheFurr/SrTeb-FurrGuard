import type { Component } from 'vue'
import IconCardId from '~icons/pixelarticons/card-id'
import IconLabel from '~icons/pixelarticons/label'
import IconMapPin from '~icons/pixelarticons/map-pin'
import IconRadioTower from '~icons/pixelarticons/radio-tower'
import IconWall from '~icons/pixelarticons/wall'
import type { EntryType } from '@/api/types'
import { isIpv4, isIpv6 } from './ips'

export interface EntryTypeInfo {
  value: EntryType
  label: string
  icon: Component
  placeholder: string
  help: string
}

/** Tipos del contrato (§0): nunca `asn` ni `cidr`. */
export const ENTRY_TYPES: readonly EntryTypeInfo[] = [
  {
    value: 'uuid', label: 'UUID', icon: IconCardId, placeholder: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
    help: 'UUID del jugador, con o sin guiones.',
  },
  {
    value: 'nick', label: 'Nick', icon: IconLabel, placeholder: 'Notch',
    help: 'De 1 a 16 caracteres: letras, números y _. Los jugadores de Bedrock (Floodgate) llevan . o * delante.',
  },
  {
    value: 'ip', label: 'IP', icon: IconMapPin, placeholder: '203.0.113.7',
    help: 'Una IPv4 o IPv6 concreta.',
  },
  {
    value: 'ip_range', label: 'Rango IP', icon: IconWall, placeholder: '203.0.113.0/24',
    help: 'Rango en notación CIDR. Mínimo /8 en IPv4 y /16 en IPv6.',
  },
  {
    value: 'as', label: 'AS', icon: IconRadioTower, placeholder: 'AS3352',
    help: 'Sistema autónomo del proveedor: AS3352 o solo 3352.',
  },
]

export const entryInfo = (type: string): EntryTypeInfo | undefined => ENTRY_TYPES.find((t) => t.value === type)

export const entryLabel = (type: string): string => entryInfo(type)?.label ?? type

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const NICK = /^[.*]?[A-Za-z0-9_]{1,16}$/
const AS = /^(?:AS)?\d{1,10}(?:\s.*)?$/i

export const isUuid = (value: string): boolean => UUID.test(value.trim())
export const isNick = (value: string): boolean => NICK.test(value) && value.length <= 16

/** Validación en cliente para avisar pronto; el servidor normaliza y valida de nuevo. */
export function validateEntry(type: EntryType, raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Escribe un valor.'
  switch (type) {
    case 'uuid':
      return isUuid(value) ? null : 'No es un UUID válido.'
    case 'nick':
      return isNick(value) ? null : 'Nick no válido: 1-16 caracteres (letras, números y _).'
    case 'ip':
      return isIpv4(value) || isIpv6(value) ? null : 'No es una IPv4 ni una IPv6 válida.'
    case 'ip_range': {
      const [address = '', prefix = '', extra] = value.split('/')
      const bits = /^\d{1,3}$/.test(prefix) ? Number(prefix) : Number.NaN
      if (extra !== undefined || Number.isNaN(bits)) return 'Usa notación CIDR, p. ej. 203.0.113.0/24.'
      if (isIpv4(address)) return bits >= 8 && bits <= 32 ? null : 'En IPv4 el prefijo va de /8 a /32.'
      if (isIpv6(address)) return bits >= 16 && bits <= 128 ? null : 'En IPv6 el prefijo va de /16 a /128.'
      return 'La dirección del rango no es válida.'
    }
    case 'as':
      return AS.test(value) ? null : 'Escribe el número de AS, p. ej. AS3352.'
  }
}

export const DURATION_PRESETS: readonly { minutes: number; label: string }[] = [
  { minutes: 0, label: 'Permanente' },
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 360, label: '6 horas' },
  { minutes: 720, label: '12 horas' },
  { minutes: 1440, label: '1 día' },
  { minutes: 10080, label: '7 días' },
  { minutes: 43200, label: '30 días' },
]
