<script setup lang="ts">
import { User, Settings, Server, Globe, Shield, ChevronUp } from 'lucide-vue-next'

const items = [
  { icon: User, title: 'Por UUID', description: 'Bloquea jugadores especificos por su UUID de Minecraft, permanente e inmutable.', color: 'from-purple-500 to-purple-600' },
  { icon: Settings, title: 'Por Nickname', description: 'Bloquea por nombre de jugador, util para evitar trolls con cuentas alternas.', color: 'from-magenta-500 to-pink-500' },
  { icon: Server, title: 'Por IP / CIDR', description: 'Bloquea IPs individuales o rangos completos usando notacion CIDR para mayor cobertura.', color: 'from-pink-500 to-purple-500' },
  { icon: Globe, title: 'Por ASN', description: 'Bloquea proveedores completos por su numero de Sistema Autonomo (AS).', color: 'from-purple-400 to-magenta-500' },
  { icon: Shield, title: 'Proveedores Bloqueados', description: 'Lista predefinida de proveedores VPN/Proxy/Hosting bloqueados automaticamente.', color: 'from-magenta-400 to-pink-600' },
  { icon: ChevronUp, title: 'Whitelist Global', description: 'Permite que jugadores o IPs de confianza bypassen todas las verificaciones.', color: 'from-pink-400 to-purple-600' },
]
</script>

<template>
  <section id="protection" class="py-24 section-grid-bg relative">
    <!-- Subtle separator -->
    <div class="gradient-line h-px w-full opacity-30 absolute top-0" />

    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16 section-header-reveal">
        <span class="text-sm font-mono text-purple-400 tracking-wider uppercase">// Tipos de Bloqueo</span>
        <h2 class="text-3xl md:text-4xl font-bold font-display mt-3 text-text-primary">Multiples Niveles de Proteccion</h2>
        <div class="gradient-line h-[2px] w-24 mx-auto mt-4 rounded-full" />
        <p class="text-text-secondary mt-4 max-w-xl mx-auto">Bloquea amenazas de diferentes formas segun tus necesidades</p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 service-card-offset">
        <div
          v-for="(item, i) in items"
          :key="item.title"
          class="card-3d glass-card p-7 group hover:border-glass-border-strong transition-all duration-500 relative overflow-hidden"
          :data-delay="String(i * 0.08)"
        >
          <!-- Hover glow -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            :style="{ background: 'radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(139, 92, 246, 0.06), transparent 60%)' }" />

          <div :class="`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`">
            <component :is="item.icon" :size="24" class="text-white" />
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-purple-300 transition-colors duration-300">{{ item.title }}</h3>
          <p class="text-text-secondary text-sm leading-relaxed">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
