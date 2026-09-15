<script setup lang="ts">
</script>

<template>
  <section class="py-24 relative">
    <!-- Subtle separator -->
    <div class="gradient-line h-px w-full opacity-30 absolute top-0" />

    <div class="max-w-7xl mx-auto px-6">
      <div class="cta-clip gradient-primary relative overflow-hidden p-12 md:p-20 text-center">
        <!-- Animated background elements -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute w-64 h-64 bg-white/5 rounded-full -top-20 -left-20 animate-float" />
          <div class="absolute w-48 h-48 bg-white/5 rounded-full -bottom-16 -right-16 animate-float" style="animation-delay: -3s" />
          <div class="absolute w-32 h-32 bg-white/3 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>

        <div class="relative z-10">
          <div class="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span class="text-sm text-white/90">Comienza ahora</span>
          </div>
          <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold font-display text-white mb-4">Protege tu servidor hoy</h2>
          <p class="text-white/80 max-w-xl mx-auto mb-8 text-lg">
            Implementa FurrGuard en tu servidor Velocity y mantien a los jugadores indeseados fuera. Contacta para obtener acceso.
          </p>
          <a
            href="https://discord.com/users/srteb"
            target="_blank"
            class="btn-shine btn-magnetic inline-flex items-center gap-2 bg-white text-dark-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 hover:shadow-lg transition-all duration-300"
          >
            Contactar Ahora
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
