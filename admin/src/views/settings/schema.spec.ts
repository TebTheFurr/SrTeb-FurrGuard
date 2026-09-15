import { describe, expect, it } from 'vitest'
import { ALL_FIELDS, toPayload, validateSetting } from './schema'

const field = (key: string) => ALL_FIELDS.find((f) => f.key === key)!

describe('ajustes (§7)', () => {
  it('no incluye claves eliminadas ni de sistema', () => {
    const keys = ALL_FIELDS.map((f) => f.key)
    for (const removed of ['webhook_url', 'notify_blocks', 'api_key', 'api_key_hash', 'cache_version']) expect(keys).not.toContain(removed)
  })

  it('valida rangos numéricos', () => {
    expect(validateSetting(field('country_change_min_connections'), '0')).not.toBeNull()
    expect(validateSetting(field('country_change_min_connections'), '1000')).toBeNull()
    expect(validateSetting(field('country_change_min_percentage'), '70.5')).toBeNull()
    expect(validateSetting(field('country_change_min_percentage'), '101')).not.toBeNull()
    expect(validateSetting(field('furrsecurity_session_duration'), '299')).not.toBeNull()
    expect(validateSetting(field('furrsecurity_max_failed_attempts'), '2.5')).not.toBeNull()
    expect(validateSetting(field('retention_logs_days'), '0')).toBeNull()
  })

  it('valida URL, CSV y nodo de permiso', () => {
    expect(validateSetting(field('discord_url'), '')).toBeNull()
    expect(validateSetting(field('discord_url'), 'http://discord.gg/x')).not.toBeNull()
    expect(validateSetting(field('furrsecurity_verify_url'), '')).not.toBeNull()
    expect(validateSetting(field('furrsecurity_alert_times'), '3600, 60,30')).toBeNull()
    expect(validateSetting(field('furrsecurity_alert_times'), '60,-1')).not.toBeNull()
    expect(validateSetting(field('furrsecurity_admin_permission'), 'furrsecurity.notify')).toBeNull()
    expect(validateSetting(field('furrsecurity_admin_permission'), 'Admin Perm')).not.toBeNull()
  })

  it('envía números para bool/int/float y CSV normalizado', () => {
    expect(toPayload(field('block_vpn'), '0')).toBe(0)
    expect(toPayload(field('country_change_min_percentage'), '70.5')).toBe(70.5)
    expect(toPayload(field('furrsecurity_alert_times'), '60 , 30')).toBe('60,30')
  })
})
