import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { api } from '@/api/client'
import type { Boot, Health, Overview, Section } from '@/api/types'
import { healthTone } from '@/lib/format'

const HIDE_IPS_KEY = 'furrguard.hideIps'
const HEALTH_MIN_INTERVAL_MS = 15_000

function readHideIps(): boolean {
  try {
    return localStorage.getItem(HIDE_IPS_KEY) === '1'
  } catch {
    return false
  }
}

export const useSession = defineStore('session', () => {
  const boot = shallowRef<Boot | null>(null)
  const sessionClosed = ref(false)
  const user = computed(() => (sessionClosed.value ? null : boot.value?.user ?? null))
  const permissions = computed<readonly Section[]>(() => boot.value?.permissions ?? [])
  const canSeeIps = computed(() => boot.value?.canSeeIps === true)
  const hideIps = ref(readHideIps())
  const health = shallowRef<Health | null>(null)
  const tone = computed(() => (health.value ? healthTone(health.value) : null))
  let healthAt = 0

  watch(hideIps, (hidden) => {
    try {
      localStorage.setItem(HIDE_IPS_KEY, hidden ? '1' : '0')
    } catch {
      // almacenamiento bloqueado: el interruptor sigue funcionando durante la visita
    }
  })

  function start(data: Boot): void {
    boot.value = data
  }

  const can = (section: Section): boolean => permissions.value.includes(section)

  function closeSession(): void {
    sessionClosed.value = true
  }

  function setHealth(next: Health): void {
    health.value = next
    healthAt = Date.now()
  }

  /** Estado para la línea de pulso. Si falla se conserva el último conocido: el 401 ya lo gestiona el cliente. */
  async function refreshHealth(): Promise<void> {
    if (!user.value || !can('overview') || Date.now() - healthAt < HEALTH_MIN_INTERVAL_MS) return
    healthAt = Date.now()
    try {
      setHealth((await api<Overview>('get_overview')).health)
    } catch {
      healthAt = 0
    }
  }

  return { boot, user, sessionClosed, permissions, canSeeIps, hideIps, health, tone, start, can, closeSession, setHealth, refreshHealth }
})
