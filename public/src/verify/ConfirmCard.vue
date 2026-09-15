<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import logo from '@shared/img/furrguard-128.webp'
import IconClock from '~icons/pixelarticons/clock'
import IconDiscord from '~icons/pixelarticons/discord'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconGlobe from '~icons/pixelarticons/globe'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconShield from '~icons/pixelarticons/shield'
import IconWarning from '~icons/pixelarticons/warning-box'
import IconWifi from '~icons/pixelarticons/wifi'
import { flagImage, formatCountdown, formatMadrid, parseUtc, secondsLeft } from './format'

type ConfirmData = Extract<VerifyData, { state: 'confirm' }>

const props = defineProps<{ data: ConfirmData }>()
const emit = defineEmits<{ expired: [] }>()

/** Por debajo de este margen la cuenta atrás se pinta en ámbar. */
const WARN_SECONDS = 60

const expiresAt = parseUtc(props.data.token_expires_at)
const requestedAt = formatMadrid(parseUtc(props.data.requested_at))
const country = props.data.request_country ?? 'País desconocido'
const flag = flagImage(props.data.request_country_code)
/** Si flagcdn no responde (o la CSP lo bloquea) se vuelve al icono del globo. */
const flagFailed = ref(false)

const now = ref(Date.now())
const left = computed(() => secondsLeft(expiresAt, now.value))
const confirmed = ref(false)
const sending = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

/** Recalcula desde el reloj (no descuenta de 1 en 1: sobrevive a pestañas dormidas). */
function tick(): boolean {
  now.value = Date.now()
  if (left.value > 0) return true
  clearInterval(timer)
  emit('expired')
  return false
}

function onSubmit(event: Event): void {
  if (!confirmed.value || sending.value || !tick()) {
    event.preventDefault()
    return
  }
  sending.value = true
}

/** Al volver atrás desde Discord la página sale de la bfcache con el botón bloqueado. */
function onPageShow(event: PageTransitionEvent): void {
  if (!event.persisted) return
  sending.value = false
  tick()
}

onMounted(() => {
  window.addEventListener('pageshow', onPageShow)
  if (tick()) timer = setInterval(tick, 1000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('pageshow', onPageShow)
})
</script>

<template>
  <section class="acceso-tarjeta confirmar" aria-labelledby="verificar-titulo">
    <div class="acceso-marca">
      <img :src="logo" width="56" height="56" alt="" class="pixel">
      <span class="acceso-estado"><IconShield class="icono" aria-hidden="true" /></span>
    </div>
    <h1 id="verificar-titulo">Verificación de staff</h1>
    <span class="label">FurrSecurity · FurrGuard</span>
    <p class="confirmar-intro">
      Se ha pedido acceso de staff para esta cuenta. Revisa los datos antes de seguir.
    </p>

    <dl class="datos">
      <div class="dato">
        <dt><IconGamepad class="icono" aria-hidden="true" /> Cuenta de Minecraft</dt>
        <dd class="mono">{{ data.minecraft_nick }}</dd>
      </div>
      <div class="dato">
        <dt><IconWifi class="icono" aria-hidden="true" /> IP que pidió la verificación</dt>
        <dd class="mono">{{ data.request_ip }}</dd>
      </div>
      <div class="dato">
        <dt><IconGlobe class="icono" aria-hidden="true" /> País</dt>
        <dd class="dato-pais">
          <img
            v-if="flag && !flagFailed"
            :src="flag.src"
            :srcset="flag.srcset"
            width="20"
            height="15"
            alt=""
            class="bandera"
            referrerpolicy="no-referrer"
            @error="flagFailed = true"
          >
          {{ country }}
        </dd>
      </div>
      <div class="dato">
        <dt><IconClock class="icono" aria-hidden="true" /> Solicitada</dt>
        <dd>{{ requestedAt }} <span class="faint">· hora de Madrid</span></dd>
      </div>
      <div class="dato">
        <dt><IconHourglass class="icono" aria-hidden="true" /> El enlace caduca en</dt>
        <dd>
          <span role="timer" class="chip num" :class="left <= WARN_SECONDS ? 'warn' : 'accent'">
            <span class="baliza viva" aria-hidden="true" />
            {{ formatCountdown(left) }}
          </span>
        </dd>
      </div>
    </dl>

    <p class="aviso down confirmar-aviso">
      <IconWarning class="icono" aria-hidden="true" />
      <span>
        <b>Si no eres tú quien está entrando ahora mismo desde esta IP, no continúes:</b>
        alguien podría estar intentando usar tu cuenta.
      </span>
    </p>

    <form method="post" action="/verify.php" class="confirmar-form" @submit="onSubmit">
      <input type="hidden" name="action" value="confirm">
      <input type="hidden" name="token" :value="data.token">
      <input type="hidden" name="csrf" :value="data.csrf">

      <label class="confirmo">
        <input v-model="confirmed" type="checkbox" class="check" required>
        <span>Confirmo que soy yo</span>
      </label>

      <button type="submit" class="btn-discord" :disabled="!confirmed || sending" :aria-busy="sending">
        <IconDiscord class="icono" aria-hidden="true" />
        <span>Continuar con Discord</span>
      </button>
      <p class="confirmar-nota faint">
        Discord solo confirma tu identidad: FurrGuard no recibe tu contraseña.
      </p>
    </form>
  </section>
</template>
