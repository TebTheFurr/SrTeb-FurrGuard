<script setup lang="ts">
/* Portada mínima: FurrGuard es un panel de uso privado, aquí solo va la identidad y el contacto. */
import FgFooter from '@shared/components/FgFooter.vue'
import logo from '@shared/img/furrguard-256.webp'
import './landing.css'
</script>

<template>
  <a href="#contenido" class="saltar">Saltar al contenido</a>

  <header class="cabecera">
    <div class="wrap cabecera-fila">
      <a href="/" class="marca" aria-label="FurrGuard by Tebby, inicio">
        <img :src="logo" width="32" height="32" alt="" class="pixel marca-logo">
        <span class="marca-nombre">FurrGuard</span>
      </a>
      <nav class="nav" aria-label="Principal">
        <a href="/" class="nav-enlace" aria-current="page">Inicio</a>
        <a href="/admin/" class="nav-enlace">Panel</a>
      </nav>
    </div>
  </header>

  <main id="contenido" class="portada" tabindex="-1">
    <img :src="logo" width="128" height="128" alt="" class="pixel portada-logo">
    <h1>FurrGuard <span class="portada-by">by Tebby</span></h1>
    <p class="portada-lema">Soluciones personalizadas de seguridad</p>
    <p class="portada-contacto">Contactar en Discord: <span class="mono">tebthefurr</span></p>
  </main>

  <div class="wrap pie-landing">
    <FgFooter />
  </div>
</template>
