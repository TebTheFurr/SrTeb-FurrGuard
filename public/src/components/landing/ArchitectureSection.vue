<script setup lang="ts">
import { Cpu, Database, Monitor, Bell } from 'lucide-vue-next'

const items = [
  { icon: Cpu, title: 'Plugin Velocity', description: 'Plugin nativo para Velocity 3.0+ con intercepcion en fase PreLogin. Cache inteligente con TTL configurable para consultas repetidas.', color: 'from-purple-500 to-purple-600', badge: 'Java 17+' },
  { icon: Database, title: 'Backend PHP', description: 'API REST en PHP con MySQL para persistencia. Integracion con ip-api.com para geolocalizacion y deteccion de proxies.', color: 'from-magenta-500 to-pink-500', badge: 'REST API' },
  { icon: Monitor, title: 'Panel de Administracion', description: 'Dashboard web con estadisticas en tiempo real, gestion de listas y visualizacion de logs de conexion.', color: 'from-pink-500 to-purple-500', badge: 'Vue 3' },
  { icon: Bell, title: 'Webhooks Discord', description: 'Notificaciones automaticas a Discord para alertas de seguridad, bloqueos y eventos importantes del sistema.', color: 'from-purple-400 to-magenta-500', badge: 'Real-time' },
]
</script>

<template>
  <section id="architecture" class="py-24 relative">
    <!-- Subtle separator -->
    <div class="gradient-line h-px w-full opacity-30 absolute top-0" />

    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16 section-header-reveal">
        <span class="text-sm font-mono text-purple-400 tracking-wider uppercase">// Arquitectura</span>
        <h2 class="text-3xl md:text-4xl font-bold font-display mt-3 text-text-primary">Sistema Distribuido</h2>
        <div class="gradient-line h-[2px] w-24 mx-auto mt-4 rounded-full" />
        <p class="text-text-secondary mt-4 max-w-xl mx-auto">Arquitectura optimizada para minimo impacto en el rendimiento</p>
      </div>

      <div class="grid md:grid-cols-2 gap-6 service-card-offset">
        <div
          v-for="(item, i) in items"
          :key="item.title"
          class="card-3d glass-card p-7 group hover:border-glass-border-strong transition-all duration-500 relative overflow-hidden"
          :data-delay="String(i * 0.1)"
        >
          <!-- Hover glow -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            :style="{ background: 'radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(139, 92, 246, 0.06), transparent 60%)' }" />

          <div class="flex items-start justify-between mb-5">
            <div :class="`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`">
              <component :is="item.icon" :size="24" class="text-white" />
            </div>
            <span class="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">{{ item.badge }}</span>
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-purple-300 transition-colors duration-300">{{ item.title }}</h3>
          <p class="text-text-secondary text-sm leading-relaxed">{{ item.description }}</p>
        </div>
      </div>

      <!-- Flow diagram -->
      <div class="mt-12 flex items-center justify-center gap-3 text-sm text-text-muted section-header-reveal">
        <span class="glass-card px-3 py-1.5 text-purple-300 text-xs font-mono">Jugador</span>
        <svg class="w-5 h-5 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        <span class="glass-card px-3 py-1.5 text-purple-300 text-xs font-mono">Velocity</span>
        <svg class="w-5 h-5 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        <span class="glass-card px-3 py-1.5 text-purple-300 text-xs font-mono">FurrGuard API</span>
        <svg class="w-5 h-5 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        <span class="glass-card px-3 py-1.5 text-purple-300 text-xs font-mono">ip-api</span>
      </div>
    </div>
  </section>
</template>
