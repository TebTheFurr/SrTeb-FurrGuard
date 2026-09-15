import { describe, expect, it } from 'vitest'
import { flagImage, formatCountdown, formatMadrid, parseUtc, secondsLeft } from './format'

describe('parseUtc', () => {
  it('interpreta el formato del contrato como UTC', () => {
    expect(parseUtc('2026-09-15 09:00:00')).toBe(Date.UTC(2026, 8, 15, 9, 0, 0))
  })

  it('acepta también ISO con T y Z', () => {
    expect(parseUtc('2026-09-15T09:00:00Z')).toBe(Date.UTC(2026, 8, 15, 9, 0, 0))
  })

  it.each(['', '15/09/2026 09:00:00', '2026-09-15', '2026-13-01 00:00:00', '2026-02-30 10:00:00'])(
    'rechaza %j',
    (value) => expect(parseUtc(value)).toBeNaN(),
  )
})

describe('formatMadrid', () => {
  it('pasa a horario de verano (UTC+2)', () => {
    expect(formatMadrid(parseUtc('2026-09-15 09:00:00'))).toBe('15 de septiembre de 2026 · 11:00:00')
  })

  it('pasa a horario de invierno (UTC+1)', () => {
    expect(formatMadrid(parseUtc('2026-01-15 09:05:07'))).toBe('15 de enero de 2026 · 10:05:07')
  })

  it('cambia de día cuando toca', () => {
    expect(formatMadrid(parseUtc('2026-03-28 23:30:00'))).toBe('29 de marzo de 2026 · 00:30:00')
  })

  it('muestra un guion si la fecha no es válida', () => {
    expect(formatMadrid(Number.NaN)).toBe('—')
  })
})

describe('secondsLeft', () => {
  const exp = Date.UTC(2026, 8, 15, 9, 3, 0)

  it('cuenta los segundos que quedan, redondeando hacia arriba', () => {
    expect(secondsLeft(exp, exp - 180_000)).toBe(180)
    expect(secondsLeft(exp, exp - 200)).toBe(1)
  })

  it('llega a 0 al caducar y no baja de ahí', () => {
    expect(secondsLeft(exp, exp)).toBe(0)
    expect(secondsLeft(exp, exp + 60_000)).toBe(0)
  })

  it('da el enlace por caducado si la fecha no se puede leer', () => {
    expect(secondsLeft(Number.NaN, 0)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it.each([
    [180, '3:00'],
    [65, '1:05'],
    [9, '0:09'],
    [0, '0:00'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [-4, '0:00'],
  ])('%i s → %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected)
  })
})

describe('flagImage', () => {
  it('construye la bandera de flagcdn con su versión 2x', () => {
    expect(flagImage('ES')).toEqual({
      src: 'https://flagcdn.com/20x15/es.png',
      srcset: 'https://flagcdn.com/40x30/es.png 2x',
    })
  })

  it.each([null, '', 'ESP', 'E1', '..', 'e/'])('no construye ninguna URL con %j', (code) => {
    expect(flagImage(code)).toBeNull()
  })
})
