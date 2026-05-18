<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isScrolled: boolean
  activeSection: string
}>()

const isMobileMenuOpen = ref(false)
const version = window.__FURRGUARD_VERSION__ ?? ''

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  document.body.style.overflow = isMobileMenuOpen.value ? 'hidden' : ''
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
  document.body.style.overflow = ''
}

const navLinks = [
  { href: '#features', label: 'Caracteristicas', id: 'features' },
  { href: '#architecture', label: 'Arquitectura', id: 'architecture' },
  { href: '#protection', label: 'Proteccion', id: 'protection' },
]
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
    :class="isScrolled ? 'bg-dark-900/90 backdrop-blur-2xl border-b border-glass-border-subtle shadow-lg shadow-purple-500/5' : 'bg-transparent'"
    role="banner"
  >
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <!-- Logo -->
      <a href="/" class="flex items-center gap-2.5 text-lg font-bold font-display group" aria-label="FurrGuard - Inicio">
        <div class="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-button group-hover:shadow-button-hover transition-shadow duration-300">
          <img :src="'/icono-furguard.png'" alt="FurrGuard" class="w-5 h-5 object-contain">
        </div>
        <span class="text-text-primary">Furr<span class="gradient-text">Guard</span></span>
        <span v-if="version" class="text-[10px] text-text-tertiary font-mono bg-glass border border-glass-border-subtle px-1.5 py-0.5 rounded ml-1">v{{ version }}</span>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden md:flex items-center gap-1" role="navigation" aria-label="Primary navigation">
        <a
          v-for="link in navLinks"
          :key="link.id"
          :href="link.href"
          class="nav-link-underline flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-hover"
          :class="{ active: activeSection === link.id }"
          @click="closeMobileMenu"
        >
          <span>{{ link.label }}</span>
        </a>
        <div class="w-px h-5 bg-glass-border-subtle mx-2" />
        <a
          href="https://discord.com/users/srteb"
          target="_blank"
          class="btn-shine btn-magnetic gradient-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-button hover:shadow-button-hover transition-all duration-300"
        >
          Contactar
        </a>
      </nav>

      <!-- Mobile Menu Button -->
      <button
        class="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-hover transition-colors"
        :aria-expanded="isMobileMenuOpen"
        aria-controls="mobile-navigation"
        aria-label="Toggle menu"
        @click="toggleMobileMenu"
      >
        <span class="w-6 h-0.5 bg-text-primary transition-all duration-300 origin-center" :class="{ 'rotate-45 translate-y-2': isMobileMenuOpen }" />
        <span class="w-6 h-0.5 bg-text-primary transition-all duration-300" :class="{ 'opacity-0 scale-0': isMobileMenuOpen }" />
        <span class="w-6 h-0.5 bg-text-primary transition-all duration-300 origin-center" :class="{ '-rotate-45 -translate-y-2': isMobileMenuOpen }" />
      </button>
    </div>

    <!-- Mobile Nav Overlay -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <nav
        v-if="isMobileMenuOpen"
        id="mobile-navigation"
        class="md:hidden bg-dark-800/98 backdrop-blur-2xl border-b border-glass-border p-6 flex flex-col gap-2"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <a
          v-for="link in navLinks"
          :key="link.id"
          :href="link.href"
          class="text-text-secondary hover:text-text-primary hover:bg-hover transition-all duration-200 py-3 px-4 rounded-xl"
          :class="{ 'text-purple-400 bg-hover': activeSection === link.id }"
          @click="closeMobileMenu"
        >
          {{ link.label }}
        </a>
        <div class="h-px bg-glass-border-subtle my-2" />
        <a
          href="https://discord.com/users/srteb"
          target="_blank"
          class="btn-shine gradient-primary text-white text-center font-semibold px-5 py-3 rounded-xl"
          @click="closeMobileMenu"
        >
          Contactar
        </a>
      </nav>
    </Transition>
  </header>
</template>
