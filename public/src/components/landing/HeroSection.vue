<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const stats = [
  { value: '100', suffix: '%', label: 'Deteccion' },
  { value: '<', prefix: '<', suffix: '50ms', label: 'Latencia' },
  { value: '24/7', label: 'Proteccion' },
]

// Terminal typing animation
const terminalLines = ref<{ text: string; cls: string; visible: boolean; typing: boolean }[]>([])

const allLines = [
  { text: '$ ./furrguard --check', cls: 'command-line' },
  { text: '> Analizando conexion...', cls: 'output-line' },
  { text: '> IP: 192.168.1.1', cls: 'output-line' },
  { text: '> Pais: ES | ISP: Movistar', cls: 'output-line' },
  { text: '// Proxy detectado: NO', cls: 'comment-line' },
  { text: '', cls: 'spacer' },
  { text: '$ status --all', cls: 'command-line' },
  { text: '> Conexion: PERMITIDA', cls: 'output-line', highlight: true },
]

let typingTimer: ReturnType<typeof setTimeout> | null = null

function startTerminalAnimation() {
  let lineIndex = 0
  let charIndex = 0
  terminalLines.value = []

  function typeNextChar() {
    if (lineIndex >= allLines.length) return

    const line = allLines[lineIndex]!
    if (line.cls === 'spacer') {
      terminalLines.value.push({ text: '', cls: line.cls, visible: true, typing: false })
      lineIndex++
      typingTimer = setTimeout(typeNextChar, 100)
      return
    }

    if (charIndex === 0) {
      terminalLines.value.push({ text: '', cls: line.cls, visible: true, typing: true })
    }

    const current = terminalLines.value[lineIndex]
    if (charIndex < line.text.length) {
      if (current) current.text = line.text.slice(0, charIndex + 1)
      charIndex++
      const delay = line.cls === 'command-line' && charIndex === 1 ? 600 : 25 + Math.random() * 20
      typingTimer = setTimeout(typeNextChar, delay)
    } else {
      if (current) current.typing = false
      charIndex = 0
      lineIndex++
      const nextDelay = line.cls === 'command-line' ? 600 : 300
      typingTimer = setTimeout(typeNextChar, nextDelay)
    }
  }

  typingTimer = setTimeout(typeNextChar, 800)
}

onMounted(() => {
  startTerminalAnimation()
})

onUnmounted(() => {
  if (typingTimer) clearTimeout(typingTimer)
})
</script>

<template>
  <section class="relative min-h-screen flex items-center pt-20 overflow-hidden">
    <!-- Animated background -->
    <div class="floating-shapes absolute inset-0 pointer-events-none">
      <div class="shape shape-1" />
      <div class="shape shape-2" />
      <div class="shape shape-3" />
      <!-- Grid overlay -->
      <div class="absolute inset-0 hero-grid-pattern opacity-30" />
    </div>

    <div class="max-w-7xl mx-auto px-6 py-20 relative z-10 w-full">
      <div class="grid lg:grid-cols-2 gap-16 items-center hero-stagger">
        <!-- Text -->
        <div class="flex flex-col gap-7">
          <div class="inline-flex items-center gap-2 bg-glass border border-glass-border-subtle rounded-full px-4 py-2 w-fit backdrop-blur-sm">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span class="text-sm text-text-secondary">Proteccion Avanzada para Minecraft</span>
          </div>

          <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight">
            <span class="gradient-text">FurrGuard</span><br>
            <span class="text-text-primary">Anti-Proxy / VPN / Hosting<span class="cursor-blink" /></span>
          </h1>

          <p class="text-text-secondary text-lg max-w-xl leading-relaxed">
            Sistema de proteccion profesional para servidores Minecraft. Detecta y bloquea automaticamente proxies, VPNs y conexiones desde datacenters con geolocalizacion en tiempo real.
          </p>

          <div class="flex flex-wrap gap-4">
            <a href="#features" class="btn-shine btn-magnetic group gradient-primary text-white font-semibold px-8 py-3.5 rounded-xl shadow-button hover:shadow-button-hover transition-all duration-300">
              Ver Caracteristicas
              <svg class="inline-block w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            <a href="https://discord.com/users/srteb" target="_blank"
              class="btn-shine border border-glass-border text-text-primary font-semibold px-8 py-3.5 rounded-xl hover:bg-glass hover:border-glass-border-strong transition-all duration-300 backdrop-blur-sm">
              Solicitar Demo
            </a>
          </div>

          <div class="flex gap-10 mt-6 pt-6 border-t border-glass-border-subtle">
            <div v-for="stat in stats" :key="stat.label" class="flex flex-col">
              <span class="text-2xl font-bold gradient-text stat-counter">{{ stat.prefix }}{{ stat.value }}{{ stat.suffix }}</span>
              <span class="text-xs text-text-muted uppercase tracking-wider mt-1">{{ stat.label }}</span>
            </div>
          </div>
        </div>

        <!-- Terminal -->
        <div class="hidden lg:block" aria-hidden="true">
          <div class="hero-terminal relative">
            <div class="absolute -inset-[1px] rounded-[17px] gradient-primary opacity-20 blur-sm" />
            <div class="terminal-header">
              <div class="flex gap-2">
                <span class="terminal-dot red" />
                <span class="terminal-dot yellow" />
                <span class="terminal-dot green" />
              </div>
              <span class="text-xs text-text-muted font-mono ml-3">furrguard --check</span>
              <div class="ml-auto flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span class="text-xs text-text-muted">live</span>
              </div>
            </div>
            <div class="terminal-body">
              <template v-for="(line, idx) in terminalLines" :key="idx">
                <div v-if="line.cls === 'spacer'" class="h-4" />
                <div v-else :class="line.cls">
                  <span v-if="line.cls === 'command-line'" class="prompt">$ </span>
                  <span v-if="line.cls === 'output-line'" class="output-prefix">&gt; </span>
                  <span :class="{
                    'command-text': line.cls === 'command-line',
                    'output-text': line.cls === 'output-line' && !line.text.includes('PERMITIDA'),
                    'comment-text': line.cls === 'comment-line',
                    'highlight-text': line.text.includes('PERMITIDA'),
                  }">{{ line.text }}</span>
                  <span v-if="line.typing" class="typing-cursor">|</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-bounce">
      <span class="text-xs text-text-muted">Scroll</span>
      <svg class="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
    </div>
  </section>
</template>
