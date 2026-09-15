import { describe, expect, it, vi } from 'vitest'
import { applyScrub, resolveView, scrubUrl } from './boot'

const confirm = {
  state: 'confirm',
  csrf: 'c'.repeat(64),
  token: 'a'.repeat(64),
  minecraft_nick: 'SrTeb',
  request_ip: '83.45.10.20',
  request_country: 'Spain',
  request_country_code: 'ES',
  requested_at: '2026-09-15 09:00:00',
  token_expires_at: '2026-09-15 09:03:00',
}

describe('resolveView', () => {
  it('muestra la landing si verify.php no inyectó nada', () => {
    expect(resolveView(undefined)).toEqual({ kind: 'landing' })
    expect(resolveView(null)).toEqual({ kind: 'landing' })
  })

  it('muestra la confirmación con los campos del contrato', () => {
    expect(resolveView(confirm)).toEqual({ kind: 'verify', data: confirm })
  })

  it('descarta campos que no están en el contrato', () => {
    const view = resolveView({ ...confirm, discord_login_url: 'https://evil.example' })
    expect(view.kind === 'verify' && 'discord_login_url' in view.data).toBe(false)
  })

  it('acepta país desconocido como null', () => {
    const view = resolveView({ ...confirm, request_country: null, request_country_code: undefined })
    expect(view).toMatchObject({ kind: 'verify', data: { request_country: null, request_country_code: null } })
  })

  it('muestra éxito y error tal cual los manda el servidor', () => {
    const ok = { state: 'success', title: 'Verificado', message: 'Vuelve al juego.' }
    const ko = { state: 'error', title: 'Token expirado', message: 'Reconecta.', code: 'token_expired' }
    expect(resolveView(ok)).toEqual({ kind: 'verify', data: ok })
    expect(resolveView(ko)).toEqual({ kind: 'verify', data: ko })
  })

  it.each([
    ['un estado desconocido', { state: 'form', minecraft_nick: 'x' }],
    ['una confirmación sin token', { ...confirm, token: '' }],
    ['una confirmación sin csrf', { ...confirm, csrf: undefined }],
    ['un error sin mensaje', { state: 'error', title: 'x', code: 'y' }],
    ['un éxito con título vacío', { state: 'success', title: '', message: 'x' }],
    ['algo que no es un objeto', 'confirm'],
  ])('convierte %s en un error genérico (nunca en la landing)', (_, raw) => {
    expect(resolveView(raw)).toMatchObject({ kind: 'verify', data: { state: 'error', code: 'invalid_data' } })
  })
})

describe('scrubUrl', () => {
  it('quita token, code y state y conserva lo demás', () => {
    expect(scrubUrl('https://fg.example/verify.php?token=abc&lang=es&code=1&state=2#x'))
      .toBe('/verify.php?lang=es#x')
  })

  it('deja la ruta limpia cuando no queda nada', () => {
    expect(scrubUrl('https://fg.example/verify.php?code=1&state=2')).toBe('/verify.php')
  })

  it('devuelve null si no hay nada que limpiar', () => {
    expect(scrubUrl('https://fg.example/?utm=1#modulos')).toBeNull()
  })
})

describe('applyScrub', () => {
  it('reemplaza la entrada del historial sin añadir otra', () => {
    const history = { state: { n: 1 }, replaceState: vi.fn() }
    applyScrub({ href: 'https://fg.example/verify.php?token=abc' }, history)
    expect(history.replaceState).toHaveBeenCalledExactlyOnceWith({ n: 1 }, '', '/verify.php')
  })

  it('no toca el historial si la URL ya está limpia', () => {
    const history = { state: null, replaceState: vi.fn() }
    applyScrub({ href: 'https://fg.example/' }, history)
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})
