<script setup lang="ts">
import { computed, ref } from 'vue'
import FgFooter from '@shared/components/FgFooter.vue'
import logo from '@shared/img/furrguard-128.webp'
import IconCheck from '~icons/pixelarticons/check'
import IconClose from '~icons/pixelarticons/close'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconReload from '~icons/pixelarticons/reload'
import ConfirmCard from './ConfirmCard.vue'
import './verify.css'

type ResultData = Exclude<VerifyData, { state: 'confirm' }>

const props = defineProps<{ data: VerifyData }>()

const EXPIRED: ResultData = {
  state: 'error',
  title: 'Enlace caducado',
  message: 'Este enlace de verificación ya no es válido.',
  code: 'token_expired',
}

const current = ref<VerifyData>(props.data)

document.title = 'Verificación de staff · FurrGuard'

const stateIcon = computed(() => {
  const data = current.value
  if (data.state === 'success') return IconCheck
  if (data.state === 'error' && /expired|caduc/.test(data.code)) return IconHourglass
  return IconClose
})
</script>

<template>
  <div class="acceso">
    <main class="acceso-centro">
      <ConfirmCard v-if="current.state === 'confirm'" :data="current" @expired="current = EXPIRED" />

      <section v-else class="acceso-tarjeta resultado" :class="current.state" aria-live="polite">
        <div class="acceso-marca">
          <img :src="logo" width="56" height="56" alt="" class="pixel">
          <span class="acceso-estado"><component :is="stateIcon" class="icono" aria-hidden="true" /></span>
        </div>
        <h1>{{ current.title }}</h1>
        <span class="label">FurrSecurity · Verificación de staff</span>
        <p v-if="current.message" class="resultado-mensaje">{{ current.message }}</p>

        <p v-if="current.state === 'success'" class="aviso info">
          <IconGamepad class="icono" aria-hidden="true" />
          <span>Ya puedes volver a Minecraft y cerrar esta pestaña.</span>
        </p>
        <template v-else>
          <p class="aviso">
            <IconReload class="icono" aria-hidden="true" />
            <span>Vuelve a entrar al servidor para generar un enlace nuevo. Si el problema sigue, avisa a un administrador.</span>
          </p>
          <span v-if="current.code" class="chip tenue resultado-codigo">código: {{ current.code }}</span>
        </template>
      </section>
    </main>

    <div class="acceso-pie">
      <FgFooter compact />
    </div>
  </div>
</template>
