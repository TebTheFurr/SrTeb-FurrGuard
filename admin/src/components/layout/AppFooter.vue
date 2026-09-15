<script setup lang="ts">
const version = __APP_VERSION__

const protectionLinks = [
  { label: 'Deteccion de Proxy', href: '/#features' },
  { label: 'Bloqueo de VPN', href: '/#features' },
  { label: 'Filtro de Hosting', href: '/#features' },
  { label: 'Tipos de Bloqueo', href: '/#protection' },
]

const systemLinks = [
  { label: 'Plugin Velocity', href: '/#architecture' },
  { label: 'Backend PHP', href: '/#architecture' },
  { label: 'Panel Admin', href: '/#architecture' },
  { label: 'Webhooks Discord', href: '/#architecture' },
]

const legalLinks = [
  { label: 'Aviso Legal', href: '#' },
  { label: 'Politica de Privacidad', href: '#' },
  { label: 'Terminos de Servicio', href: '#' },
]
</script>

<template>
  <footer class="relative pt-10 pb-6" role="contentinfo">
    <!-- Top separator with gradient -->
    <div class="gradient-line h-px w-full absolute top-0 opacity-60" />

    <div class="px-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        <!-- Brand -->
        <div class="lg:col-span-1">
          <a href="/" class="flex items-center gap-2.5 text-lg font-bold font-display mb-3 group">
            <div class="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center group-hover:shadow-glow transition-shadow duration-300">
              <img :src="'/icono-furguard.png'" alt="FurrGuard" class="w-4 h-4 object-contain">
            </div>
            <span class="text-text-primary">Furr<span class="gradient-text">Guard</span></span>
          </a>
          <p class="text-text-muted text-sm leading-relaxed mb-4">
            Sistema de proteccion anti-proxy/VPN para servidores Minecraft.
          </p>
          <div class="flex gap-2.5">
            <a href="https://discord.com/users/srteb" target="_blank" rel="noopener noreferrer" aria-label="Contactar por Discord"
              class="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-text-muted hover:text-purple-400 hover:shadow-glow transition-all duration-300 active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </a>
            <a href="https://github.com/grinchhorizon" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
              class="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-text-muted hover:text-purple-400 hover:shadow-glow transition-all duration-300 active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
          </div>
        </div>

        <!-- Links -->
        <div>
          <h4 class="text-xs font-semibold text-purple-400/70 mb-3 uppercase tracking-widest">Proteccion</h4>
          <nav aria-label="Footer navigation - Proteccion">
            <ul class="space-y-2">
              <li v-for="link in protectionLinks" :key="link.label">
                <a :href="link.href" class="text-sm text-text-muted hover:text-purple-400 transition-colors duration-200 flex items-center gap-2 group">
                  <span class="w-1 h-1 rounded-full bg-purple-500/30 group-hover:bg-purple-400 group-hover:scale-150 transition-all" />
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-purple-400/70 mb-3 uppercase tracking-widest">Sistema</h4>
          <nav aria-label="Footer navigation - Sistema">
            <ul class="space-y-2">
              <li v-for="link in systemLinks" :key="link.label">
                <a :href="link.href" class="text-sm text-text-muted hover:text-purple-400 transition-colors duration-200 flex items-center gap-2 group">
                  <span class="w-1 h-1 rounded-full bg-purple-500/30 group-hover:bg-purple-400 group-hover:scale-150 transition-all" />
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-purple-400/70 mb-3 uppercase tracking-widest">Legal</h4>
          <nav aria-label="Footer navigation - Legal">
            <ul class="space-y-2">
              <li v-for="link in legalLinks" :key="link.label">
                <a :href="link.href" class="text-sm text-text-muted hover:text-purple-400 transition-colors duration-200 flex items-center gap-2 group">
                  <span class="w-1 h-1 rounded-full bg-purple-500/30 group-hover:bg-purple-400 group-hover:scale-150 transition-all" />
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div class="border-t border-glass-border-subtle pt-4 flex flex-col md:flex-row items-center justify-between gap-2">
        <p class="text-xs text-text-muted">&copy; {{ new Date().getFullYear() }} SrTeb Limited & Teb Solutions S.L.</p>
        <p class="text-[11px] text-text-tertiary font-mono">FurrGuard Admin v{{ version }}</p>
      </div>
    </div>
  </footer>
</template>
