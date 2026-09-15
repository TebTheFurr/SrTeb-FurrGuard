import { describe, expect, it } from 'vitest'
import { formatDateTime, isPast, parseUtc, timeAgo } from './dates'

describe('fechas UTC → Europe/Madrid', () => {
  it('interpreta el formato del servidor como UTC', () => {
    expect(parseUtc('2026-09-15 18:00:00')?.toISOString()).toBe('2026-09-15T18:00:00.000Z')
    expect(parseUtc('')).toBeNull()
    expect(parseUtc('ayer')).toBeNull()
    expect(parseUtc(null)).toBeNull()
  })

  it('muestra la hora de Madrid en verano (UTC+2) y en invierno (UTC+1)', () => {
    expect(formatDateTime('2026-09-15 18:00:00')).toBe('15/09/2026, 20:00')
    expect(formatDateTime('2026-01-15 18:00:00')).toBe('15/01/2026, 19:00')
  })

  it('cambia de día al cruzar la medianoche de Madrid', () => {
    expect(formatDateTime('2026-09-15 22:30:00')).toBe('16/09/2026, 00:30')
  })

  it('pinta un guion si no hay fecha', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(timeAgo(undefined)).toBe('—')
  })

  it('«hace X» y «dentro de X» respecto a ahora', () => {
    const now = Date.UTC(2026, 8, 15, 10, 0, 0)
    expect(timeAgo('2026-09-15 10:00:20', now)).toBe('ahora mismo')
    expect(timeAgo('2026-09-15 09:59:50', now)).toBe('ahora mismo')
    expect(timeAgo('2026-09-15 09:55:00', now)).toBe('hace 5 minutos')
    expect(timeAgo('2026-09-15 12:00:00', now)).toBe('dentro de 2 horas')
    expect(timeAgo('2026-09-14 10:00:00', now)).toBe('ayer')
    expect(timeAgo('2026-06-15 10:00:00', now)).toBe('hace 3 meses')
  })

  it('isPast compara en UTC', () => {
    const now = Date.UTC(2026, 8, 15, 10, 0, 0)
    expect(isPast('2026-09-15 09:59:59', now)).toBe(true)
    expect(isPast('2026-09-15 10:00:01', now)).toBe(false)
    expect(isPast(null, now)).toBe(false)
  })
})
