import { describe, expect, it } from 'vitest'
import { parseMc } from './mc'

const compact = (input: string) =>
  parseMc(input).map(({ text, color, bold, italic, underline, strike }) => ({
    text, color, ...(bold && { bold }), ...(italic && { italic }), ...(underline && { underline }), ...(strike && { strike }),
  }))

describe('parseMc (& y §)', () => {
  it('colores con & y con §', () => {
    expect(compact('&aHola §cmundo')).toEqual([
      { text: 'Hola ', color: '#55FF55' },
      { text: 'mundo', color: '#FF5555' },
    ])
  })

  it('los formatos se acumulan y un color los reinicia', () => {
    expect(compact('&6&lFurr&oGuard&7 texto')).toEqual([
      { text: 'Furr', color: '#FFAA00', bold: true },
      { text: 'Guard', color: '#FFAA00', bold: true, italic: true },
      { text: ' texto', color: '#AAAAAA' },
    ])
  })

  it('&r vuelve al estilo por defecto', () => {
    expect(compact('&c&nAviso&r normal')).toEqual([
      { text: 'Aviso', color: '#FF5555', underline: true },
      { text: ' normal', color: null },
    ])
  })

  it('mayúsculas en el código también valen', () => {
    expect(compact('&CRojo')[0]?.color).toBe('#FF5555')
  })

  it('códigos desconocidos y & sueltos se quedan como texto', () => {
    expect(compact('Tom & Jerry &z 100%&')).toEqual([{ text: 'Tom & Jerry &z 100%&', color: null }])
  })

  it('colores hex &#RRGGBB y &x&R&R&G&G&B&B', () => {
    expect(compact('&#ff8800Naranja')).toEqual([{ text: 'Naranja', color: '#FF8800' }])
    expect(compact('&x&1&2&3&4&5&6Hex')).toEqual([{ text: 'Hex', color: '#123456' }])
  })

  it('el HTML se conserva como texto (la vista no usa v-html)', () => {
    expect(compact('&c<img src=x onerror=alert(1)>')).toEqual([{ text: '<img src=x onerror=alert(1)>', color: '#FF5555' }])
  })

  it('\\n literal y saltos reales son saltos de línea', () => {
    expect(parseMc('a\\nb\nc').map((s) => s.text).join('')).toBe('a\nb\nc')
  })

  it('variables sin tocar', () => {
    expect(compact('&7Jugador: &f{player}')).toEqual([
      { text: 'Jugador: ', color: '#AAAAAA' },
      { text: '{player}', color: '#FFFFFF' },
    ])
  })
})
