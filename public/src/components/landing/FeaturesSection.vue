<script setup lang="ts">
import { Shield, Lock, Server, Users, Bell, Globe } from 'lucide-vue-next'

const features = [
  { icon: Shield, title: 'Deteccion de Proxy', description: 'Identifica y bloquea conexiones que utilizan proxies para ocultar su IP real mediante analisis de ASN y proveedores.', color: 'from-purple-500 to-purple-600' },
  { icon: Lock, title: 'Bloqueo de VPN', description: 'Detecta servicios VPN populares: NordVPN, ExpressVPN, Surfshark y mas de 50 proveedores automaticamente.', color: 'from-magenta-500 to-pink-500' },
  { icon: Server, title: 'Filtro de Hosting', description: 'Bloquea conexiones desde datacenters: AWS, Azure, DigitalOcean, Google Cloud y mas proveedores cloud.', color: 'from-pink-500 to-purple-500' },
  { icon: Users, title: 'Whitelist / Blacklist', description: 'Gestiona listas de permitidos y bloqueados por UUID, nickname, IP, CIDR o numero AS.', color: 'from-purple-400 to-magenta-500' },
  { icon: Bell, title: 'Alertas en Tiempo Real', description: 'Recibe notificaciones instantaneas en Discord cuando se detecta o bloquea una conexion sospechosa.', color: 'from-magenta-400 to-pink-600' },
  { icon: Globe, title: 'Geolocalizacion', description: 'Informacion detallada del pais, ciudad, ISP, ASN y tipo de conexion de cada jugador.', color: 'from-pink-400 to-purple-600' },
]
</script>

<template>
  <section id="features" class="py-24 section-grid-bg relative">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16 section-header-reveal">
        <span class="text-sm font-mono text-purple-400 tracking-wider uppercase">// Caracteristicas</span>
        <h2 class="text-3xl md:text-4xl font-bold font-display mt-3 text-text-primary">Proteccion Completa</h2>
        <div class="gradient-line h-[2px] w-24 mx-auto mt-4 rounded-full" />
        <p class="text-text-secondary mt-4 max-w-xl mx-auto">Herramientas avanzadas de seguridad para tu servidor Minecraft</p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 service-card-offset">
        <div
          v-for="(feature, i) in features"
          :key="feature.title"
          class="card-3d glass-card p-7 group hover:border-glass-border-strong transition-all duration-500 relative overflow-hidden"
          :data-delay="String(i * 0.08)"
        >
          <!-- Hover glow -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            :style="{ background: 'radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(139, 92, 246, 0.06), transparent 60%)' }" />

          <div :class="`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`">
            <component :is="feature.icon" :size="24" class="text-white" />
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-purple-300 transition-colors duration-300">{{ feature.title }}</h3>
          <p class="text-text-secondary text-sm leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
