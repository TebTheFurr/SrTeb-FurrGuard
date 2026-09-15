<script setup lang="ts">
import { onMounted } from 'vue'
import FgFooter from '@shared/components/FgFooter.vue'
import logo128 from '@shared/img/furrguard-128.webp'
import poster640 from '@shared/img/poster-640.webp'
import poster1280 from '@shared/img/poster-1280.webp'
import IconArrowDown from '~icons/lucide/arrow-down'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconCloudServer from '~icons/pixelarticons/cloud-server'
import IconCrown from '~icons/pixelarticons/crown'
import IconDiscord from '~icons/pixelarticons/discord'
import IconEyeClosed from '~icons/pixelarticons/eye-closed'
import IconLock from '~icons/pixelarticons/lock'
import IconUsers from '~icons/pixelarticons/users'
import SiteHeader from './SiteHeader.vue'
import { vReveal } from './reveal'
import {
  DEGRADED_NOTE, DISCORD_URL, FLOW, HERO_FACTS, MODULES, PANEL_FEATURES, PANEL_URL,
  PERMS_COMMANDS, PERMS_NOTES, ROLES, SECURITY_NOTES, SECURITY_STEPS,
} from './content'
import './landing.css'

const posterSrcset = `${poster640} 640w, ${poster1280} 1280w`
const stepNumber = (index: number): string => String(index + 1).padStart(2, '0')

onMounted(() => {
  // La página la pinta JS: el salto nativo a /#seccion ocurre antes de que exista la sección
  const target = window.location.hash.slice(1)
  if (target) document.getElementById(target)?.scrollIntoView()
})
</script>

<template>
  <a href="#contenido" class="saltar">Saltar al contenido</a>
  <SiteHeader />

  <main id="contenido">
    <!-- ── portada ─────────────────────────────────────────────────────── -->
    <section id="inicio" class="hero" aria-labelledby="hero-titulo">
      <div class="wrap hero-rejilla">
        <div v-reveal class="hero-texto">
          <span class="chip accent hero-eyebrow">
            <span class="baliza viva" aria-hidden="true" /> Seguridad para redes de Minecraft
          </span>
          <h1 id="hero-titulo">
            Tu red de Minecraft, protegida <span class="acento">desde la primera conexión</span>.
          </h1>
          <p class="hero-lead">
            FurrGuard revisa a cada jugador que entra por Velocity: detecta proxys, VPN, hosting y redes
            móviles, aplica tus listas y tus bloqueos por país y obliga a tu staff a verificarse con Discord
            antes de tocar nada.
          </p>
          <div class="hero-acciones">
            <a :href="DISCORD_URL" class="btn primary lg" target="_blank" rel="noopener noreferrer">
              <IconDiscord class="icono" aria-hidden="true" /> Únete al Discord
            </a>
            <a href="#como-funciona" class="btn lg">
              Ver cómo funciona <IconArrowDown class="glifo" aria-hidden="true" />
            </a>
          </div>
          <ul class="hero-datos">
            <li v-for="fact in HERO_FACTS" :key="fact.text">
              <component :is="fact.icon" class="icono" aria-hidden="true" />{{ fact.text }}
            </li>
          </ul>
        </div>

        <div v-reveal class="hero-arte">
          <img
            :src="poster1280"
            :srcset="posterSrcset"
            sizes="(min-width: 1021px) 540px, (min-width: 641px) 640px, calc(100vw - 32px)"
            width="1280"
            height="764"
            fetchpriority="high"
            decoding="async"
            alt="Póster de FurrGuard: un zorro con armadura de diamante y escudo ante un muro de obsidiana y redstone con un candado dorado"
          >
          <div class="consola" aria-hidden="true">
            <p class="consola-cab"><span class="baliza ok" /> check_player</p>
            <p><span class="k">jugador</span><span>Steve · 83.45.•••.•••</span></p>
            <p><span class="k">geo</span><span>ES · AS3352</span></p>
            <p><span class="k">blacklist</span><span class="ok">sin coincidencias</span></p>
            <p><span class="k">reglas</span><span class="ok">proxy · vpn · hosting: ok</span></p>
            <p class="consola-res">→ allowed</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── cómo funciona ──────────────────────────────────────────────── -->
    <section id="como-funciona" class="seccion alterna" aria-labelledby="flujo-titulo">
      <div class="wrap">
        <header v-reveal class="seccion-cab">
          <span class="label">01 · Cómo funciona</span>
          <h2 id="flujo-titulo">Cada conexión pasa por el mismo filtro, siempre en el mismo orden</h2>
          <p>Así decide FurrGuard, en cada entrada, si un jugador pasa o se queda fuera.</p>
        </header>

        <ol class="flujo">
          <li v-for="(step, index) in FLOW" :key="step.title" v-reveal class="paso">
            <div class="paso-cab">
              <span class="slot"><component :is="step.icon" class="icono" aria-hidden="true" /></span>
              <span class="paso-num mono" aria-hidden="true">{{ stepNumber(index) }}</span>
            </div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
            <p v-if="step.order" class="orden">
              <template v-for="(item, position) in step.order" :key="item">
                <IconChevronRight v-if="position > 0" class="glifo orden-sep" aria-hidden="true" /><code>{{ item }}</code>
              </template>
            </p>
          </li>
        </ol>

        <div v-reveal class="flujo-final">
          <p class="resultado-linea">
            <span class="chip ok"><span class="baliza" aria-hidden="true" /> permitido</span> o
            <span class="chip down"><span class="baliza" aria-hidden="true" /> expulsado</span>
            con el mensaje que tú hayas escrito en el panel.
          </p>
          <p class="aviso info">
            <IconCloudServer class="icono" aria-hidden="true" /><span>{{ DEGRADED_NOTE }}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- ── módulos ────────────────────────────────────────────────────── -->
    <section id="modulos" class="seccion" aria-labelledby="modulos-titulo">
      <div class="wrap">
        <header v-reveal class="seccion-cab">
          <span class="label">02 · Módulos</span>
          <h2 id="modulos-titulo">Todo lo que vigila el zorro</h2>
          <p>Detección automática, listas que controlas tú y reglas por país, continente o proveedor.</p>
        </header>

        <ul class="modulos">
          <li v-for="module in MODULES" :key="module.title" v-reveal class="tarjeta">
            <span class="slot"><component :is="module.icon" class="icono" aria-hidden="true" /></span>
            <h3>{{ module.title }}</h3>
            <p>{{ module.text }}</p>
            <p v-if="module.tags" class="etiquetas">
              <span v-for="tag in module.tags" :key="tag" class="chip tenue">{{ tag }}</span>
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ── staff ──────────────────────────────────────────────────────── -->
    <section id="staff" class="seccion alterna" aria-labelledby="staff-titulo">
      <div class="wrap">
        <header v-reveal class="seccion-cab">
          <span class="label">03 · Staff</span>
          <h2 id="staff-titulo">Que te roben una cuenta de staff no debería costarte el servidor</h2>
          <p>FurrSecurity y FurrPerms protegen lo que más daño hace en malas manos: los rangos y los permisos.</p>
        </header>

        <div class="staff-rejilla">
          <article v-reveal class="modulo-grande seguridad" aria-labelledby="furrsecurity-titulo">
            <div class="modulo-cab">
              <span class="slot oro"><IconLock class="icono" aria-hidden="true" /></span>
              <div>
                <h3 id="furrsecurity-titulo">FurrSecurity</h3>
                <span class="label">Verificación con Discord</span>
              </div>
            </div>
            <p class="modulo-intro">El staff demuestra que es quien dice ser antes de poder hacer nada en el servidor.</p>
            <ol class="pasos-staff">
              <li v-for="step in SECURITY_STEPS" :key="step.title">
                <span class="slot sm"><component :is="step.icon" class="icono" aria-hidden="true" /></span>
                <div>
                  <b>{{ step.title }}</b>
                  <p>{{ step.text }}</p>
                </div>
              </li>
            </ol>
            <ul class="notas">
              <li v-for="note in SECURITY_NOTES" :key="note.text">
                <component :is="note.icon" class="icono" aria-hidden="true" /><span>{{ note.text }}</span>
              </li>
            </ul>
          </article>

          <article v-reveal class="modulo-grande permisos" aria-labelledby="furrperms-titulo">
            <div class="modulo-cab">
              <span class="slot zorro"><IconCrown class="icono" aria-hidden="true" /></span>
              <div>
                <h3 id="furrperms-titulo">FurrPerms</h3>
                <span class="label">Comandos de permisos</span>
              </div>
            </div>
            <p class="modulo-intro">Aunque alguien consiga rango, no podrá darse permisos ni hacerse op.</p>
            <p class="comandos">
              <code v-for="command in PERMS_COMMANDS" :key="command">/{{ command }}</code>
            </p>
            <ul class="notas">
              <li v-for="note in PERMS_NOTES" :key="note.text">
                <component :is="note.icon" class="icono" aria-hidden="true" /><span>{{ note.text }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <!-- ── panel ──────────────────────────────────────────────────────── -->
    <section id="panel" class="seccion" aria-labelledby="panel-titulo">
      <div class="wrap panel-rejilla">
        <div v-reveal class="panel-texto">
          <header class="seccion-cab izquierda">
            <span class="label">04 · Panel web</span>
            <h2 id="panel-titulo">Toda la red, desde el navegador</h2>
            <p>Un panel con roles para que cada miembro del equipo vea solo lo que le toca.</p>
          </header>
          <ul class="notas grandes">
            <li v-for="feature in PANEL_FEATURES" :key="feature.text">
              <component :is="feature.icon" class="icono" aria-hidden="true" /><span>{{ feature.text }}</span>
            </li>
          </ul>
          <a :href="PANEL_URL" class="btn lg">Entrar al panel <IconArrowRight class="glifo" aria-hidden="true" /></a>
        </div>

        <div v-reveal class="caja">
          <div class="caja-cab">
            <IconUsers class="icono" aria-hidden="true" />
            <h3>Roles</h3>
            <span class="faint">secciones</span>
          </div>
          <ul class="roles">
            <li v-for="role in ROLES" :key="role.name" class="rol">
              <span class="chip" :class="role.tone">{{ role.name }}</span>
              <span class="rol-texto">{{ role.text }}</span>
              <span class="rol-num mono">{{ role.sections }}<span class="sr-only"> secciones</span></span>
            </li>
          </ul>
          <p class="caja-pie">
            <IconEyeClosed class="icono" aria-hidden="true" />
            <span>Sin la sección de IPs, el servidor las oculta: ni se ven ni se pueden buscar.</span>
          </p>
        </div>
      </div>
    </section>

    <!-- ── llamada final ──────────────────────────────────────────────── -->
    <section class="seccion cta-seccion" aria-labelledby="cta-titulo">
      <div class="wrap">
        <div v-reveal class="cta">
          <img :src="logo128" width="88" height="88" alt="" class="pixel cta-logo" loading="lazy" decoding="async">
          <div>
            <h2 id="cta-titulo">¿Llevas una red de Minecraft?</h2>
            <p>FurrGuard lo desarrolla SrTeb Limited. Pásate por nuestro Discord y te contamos cómo ponerlo a vigilar tu red.</p>
          </div>
          <div class="cta-acciones">
            <a :href="DISCORD_URL" class="btn primary lg" target="_blank" rel="noopener noreferrer">
              <IconDiscord class="icono" aria-hidden="true" /> Únete al Discord
            </a>
            <a :href="PANEL_URL" class="btn lg">Entrar al panel</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <div class="wrap pie-landing">
    <FgFooter />
  </div>
</template>
