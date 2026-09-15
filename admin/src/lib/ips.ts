/**
 * Localiza IPs dentro de texto libre (detalles del registro) para que el componente IpText
 * las oculte igual que las columnas de IP cuando el interruptor «ocultar IPs» está activo.
 */

const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`
const IPV4 = String.raw`(?<![\d.])${OCTET}(?:\.${OCTET}){3}(?:\/\d{1,2})?(?!\.?\d)`
const H = '[0-9a-f]{1,4}'
const IPV6 = String.raw`(?<![\w:])(?:(?:${H}:){7}${H}|(?:${H}:){1,7}:(?:${H}(?::${H}){0,6})?|::(?:${H}(?::${H}){0,6})?)(?:\/\d{1,3})?(?![\w:])`
const IP_PATTERN = new RegExp(`${IPV4}|${IPV6}`, 'gi')

export interface TextPart {
  text: string
  ip: boolean
}

export function splitIps(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(IP_PATTERN)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start), ip: false })
    parts.push({ text: match[0], ip: true })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), ip: false })
  return parts
}

const IPV4_ONLY = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)

export function isIpv4(value: string): boolean {
  return IPV4_ONLY.test(value)
}

/** IPv6 validada con el parser de URL del navegador (rechaza zonas y formas inválidas). */
export function isIpv6(value: string): boolean {
  if (!value.includes(':') || /[[\]/%\s]/.test(value)) return false
  try {
    return new URL(`http://[${value}]/`).hostname.length > 2
  } catch {
    return false
  }
}
