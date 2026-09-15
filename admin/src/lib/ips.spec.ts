import { describe, expect, it } from 'vitest'
import { validateEntry } from './entries'
import { splitIps } from './ips'

const ipsIn = (text: string): string[] => splitIps(text).filter((p) => p.ip).map((p) => p.text)

describe('splitIps', () => {
  it('encuentra IPv4, IPv6 y rangos dentro de texto', () => {
    expect(ipsIn('IP: 1.2.3.4 (hija de uuid: 069a79f4-44e9-4726-a5be-fca90e38aaf5)')).toEqual(['1.2.3.4'])
    expect(ipsIn('Baneo 2001:db8::1/64. Otra ::1 y fe80::1ff:fe23:4567:890a')).toEqual(['2001:db8::1/64', '::1', 'fe80::1ff:fe23:4567:890a'])
    expect(ipsIn('rango 203.0.113.0/24, puerto 1.2.3.4:25565')).toEqual(['203.0.113.0/24', '1.2.3.4'])
  })

  it('no confunde horas, versiones ni números largos', () => {
    expect(ipsIn('a las 12:30:45 con la versión 1.20.4 y 1.2.3.4.5')).toEqual([])
    expect(ipsIn('999.1.1.1')).toEqual([])
  })

  it('reconstruye el texto original', () => {
    const text = 'Desde 10.0.0.1 y 2001:db8::2 hoy'
    expect(splitIps(text).map((p) => p.text).join('')).toBe(text)
  })
})

describe('validateEntry (tipos del contrato)', () => {
  it('uuid y nick', () => {
    expect(validateEntry('uuid', '069a79f4-44e9-4726-a5be-fca90e38aaf5')).toBeNull()
    expect(validateEntry('uuid', '069a79f444e94726a5befca90e38aaf5')).toBeNull()
    expect(validateEntry('uuid', 'no-soy-uuid')).not.toBeNull()
    expect(validateEntry('nick', 'Notch')).toBeNull()
    expect(validateEntry('nick', '.BedrockUser')).toBeNull()
    expect(validateEntry('nick', 'nombre con espacios')).not.toBeNull()
    expect(validateEntry('nick', '*abcdefghijklmnop')).not.toBeNull()
  })

  it('ip, ip_range y as', () => {
    expect(validateEntry('ip', '203.0.113.7')).toBeNull()
    expect(validateEntry('ip', '2001:db8::1')).toBeNull()
    expect(validateEntry('ip', '203.0.113.0/24')).not.toBeNull()
    expect(validateEntry('ip_range', '203.0.113.0/24')).toBeNull()
    expect(validateEntry('ip_range', '10.0.0.0/7')).not.toBeNull()
    expect(validateEntry('ip_range', '2001:db8::/32')).toBeNull()
    expect(validateEntry('ip_range', '2001:db8::/8')).not.toBeNull()
    expect(validateEntry('ip_range', '203.0.113.7')).not.toBeNull()
    expect(validateEntry('as', 'AS3352')).toBeNull()
    expect(validateEntry('as', '3352')).toBeNull()
    expect(validateEntry('as', 'AS3352 Telefonica')).toBeNull()
    expect(validateEntry('as', 'Telefonica')).not.toBeNull()
  })
})
