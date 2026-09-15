/**
 * Intérprete de códigos de formato de Minecraft (`&` y `§`) para la vista previa de mensajes.
 * Devuelve segmentos de texto con estilo: la vista los pinta como <span> con {{ }}, nunca con
 * v-html, así que un mensaje con HTML se ve como texto.
 */

export const MC_COLORS: Readonly<Record<string, string>> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF',
  c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
}

export const MC_COLOR_NAMES: Readonly<Record<string, string>> = {
  '0': 'Negro', '1': 'Azul oscuro', '2': 'Verde oscuro', '3': 'Turquesa oscuro',
  '4': 'Rojo oscuro', '5': 'Morado', '6': 'Dorado', '7': 'Gris',
  '8': 'Gris oscuro', '9': 'Azul', a: 'Verde', b: 'Turquesa',
  c: 'Rojo', d: 'Rosa', e: 'Amarillo', f: 'Blanco',
}

export const MC_FORMATS = [
  { code: 'l', label: 'Negrita' },
  { code: 'o', label: 'Cursiva' },
  { code: 'n', label: 'Subrayado' },
  { code: 'm', label: 'Tachado' },
  { code: 'k', label: 'Ofuscado' },
  { code: 'r', label: 'Reiniciar formato' },
] as const

export interface McStyle {
  color: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  obfuscated: boolean
}

export interface McSegment extends McStyle {
  text: string
}

type FormatKey = Exclude<keyof McStyle, 'color'>

const FORMAT_KEYS: Readonly<Record<string, FormatKey>> = { l: 'bold', o: 'italic', n: 'underline', m: 'strike', k: 'obfuscated' }
const PLAIN: McStyle = { color: null, bold: false, italic: false, underline: false, strike: false, obfuscated: false }
const HEX = /^#([0-9a-f]{6})/i
const BUNGEE_HEX = /^x((?:[&§][0-9a-f]){6})/i

export function parseMc(input: string): McSegment[] {
  const source = input.replace(/\\n/g, '\n')
  const segments: McSegment[] = []
  let style: McStyle = { ...PLAIN }
  let text = ''

  const flush = (): void => {
    if (text) segments.push({ ...style, text })
    text = ''
  }

  for (let i = 0; i < source.length; i++) {
    const char = source.charAt(i)
    if ((char === '&' || char === '§') && i + 1 < source.length) {
      const rest = source.slice(i + 1, i + 14)
      const hex = HEX.exec(rest)
      const bungee = BUNGEE_HEX.exec(rest)
      const code = source.charAt(i + 1).toLowerCase()
      if (hex?.[1]) {
        flush()
        style = { ...PLAIN, color: `#${hex[1].toUpperCase()}` }
        i += 7
        continue
      }
      if (bungee?.[1]) {
        flush()
        style = { ...PLAIN, color: `#${bungee[1].replace(/[&§]/g, '').toUpperCase()}` }
        i += 13
        continue
      }
      const color = MC_COLORS[code]
      const format = FORMAT_KEYS[code]
      if (color) {
        // En Minecraft un color reinicia los formatos anteriores
        flush()
        style = { ...PLAIN, color }
        i++
        continue
      }
      if (format) {
        flush()
        style = { ...style, [format]: true }
        i++
        continue
      }
      if (code === 'r') {
        flush()
        style = { ...PLAIN }
        i++
        continue
      }
    }
    text += char
  }
  flush()
  return segments
}
