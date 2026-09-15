/** Texto legible del método y proveedores de geolocalización guardados con una conexión. */
const PROVIDERS: Record<string, string> = {
  'ip-api': 'ip-api.com',
  proxycheck: 'proxycheck.io',
  'ipapi-is': 'ipapi.is',
  freeipapi: 'freeipapi.com',
  maxmind: 'espejo MaxMind',
}

export function geoSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Sin registro (conexión anterior a la 2.0)'
  if (source === 'none') return 'Sin datos: ningún proveedor respondió'
  const cached = source.startsWith('cache:')
  const parts = (cached ? source.slice(6) : source).split('+').map((p) => PROVIDERS[p] ?? p)
  const detail = parts.length > 1 ? `${parts[0]} + ${parts.slice(1).join(' + ')}` : parts[0]
  if (source === 'maxmind') return 'Solo espejo MaxMind (proveedores remotos no disponibles: modo degradado)'
  return cached ? `Caché de IP (24 h) · origen: ${detail}` : `Consulta en directo · ${detail}`
}
