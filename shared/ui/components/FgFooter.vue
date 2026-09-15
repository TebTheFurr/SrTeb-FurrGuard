<script setup lang="ts">
/*
 * Pie común de FurrGuard (panel, login, verificación y landing).
 * Mismo diseño que el pie de Tebby Vault. Sin imports a propósito: este archivo vive
 * fuera de admin/ y public/, así que no puede resolver paquetes de node_modules.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const stars = [
  '18.00,7.45 18.36,8.50 19.47,8.52 18.59,9.19 18.91,10.25 18.00,9.62 17.09,10.25 17.41,9.19 16.53,8.52 17.64,8.50',
  '22.50,8.66 22.86,9.70 23.97,9.73 23.09,10.40 23.41,11.46 22.50,10.83 21.59,11.46 21.91,10.40 21.03,9.73 22.14,9.70',
  '25.79,11.95 26.16,13.00 27.27,13.02 26.38,13.69 26.71,14.75 25.79,14.12 24.88,14.75 25.20,13.69 24.32,13.02 25.43,13.00',
  '27.00,16.45 27.36,17.50 28.47,17.52 27.59,18.19 27.91,19.25 27.00,18.62 26.09,19.25 26.41,18.19 25.53,17.52 26.64,17.50',
  '25.79,20.95 26.16,22.00 27.27,22.02 26.38,22.69 26.71,23.75 25.79,23.12 24.88,23.75 25.20,22.69 24.32,22.02 25.43,22.00',
  '22.50,24.24 22.86,25.29 23.97,25.32 23.09,25.99 23.41,27.05 22.50,26.41 21.59,27.05 21.91,25.99 21.03,25.32 22.14,25.29',
  '18.00,25.45 18.36,26.50 19.47,26.52 18.59,27.19 18.91,28.25 18.00,27.62 17.09,28.25 17.41,27.19 16.53,26.52 17.64,26.50',
  '13.50,24.24 13.86,25.29 14.97,25.32 14.09,25.99 14.41,27.05 13.50,26.41 12.59,27.05 12.91,25.99 12.03,25.32 13.14,25.29',
  '10.21,20.95 10.57,22.00 11.68,22.02 10.80,22.69 11.12,23.75 10.21,23.12 9.29,23.75 9.62,22.69 8.73,22.02 9.84,22.00',
  '9.00,16.45 9.36,17.50 10.47,17.52 9.59,18.19 9.91,19.25 9.00,18.62 8.09,19.25 8.41,18.19 7.53,17.52 8.64,17.50',
  '10.21,11.95 10.57,13.00 11.68,13.02 10.80,13.69 11.12,14.75 10.21,14.12 9.29,14.75 9.62,13.69 8.73,13.02 9.84,13.00',
  '13.50,8.66 13.86,9.70 14.97,9.73 14.09,10.40 14.41,11.46 13.50,10.83 12.59,11.46 12.91,10.40 12.03,9.73 13.14,9.70',
]
</script>

<template>
  <footer class="fg-pie" :class="{ compacto: compact }">
    <div class="fg-pie-arriba">
      <div class="fg-pie-marca">
        <img src="../img/furrguard-64.webp" width="30" height="30" alt="">
        <span>
          FurrGuard · Seguridad para servidores <span class="sep">|</span> <b>Tebby Services S.L.</b>
        </span>
      </div>
      <div class="fg-pie-enlaces">
        <a class="fg-pie-chip" href="https://x.com/SrTeb_" target="_blank" rel="noopener noreferrer"
           aria-label="Síguenos en X">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 1.6h3.4l-7.5 8.5L23.6 22h-6.9l-5.4-7-6.2 7H1.7l8-9.1L.9 1.6h7l4.9 6.4zm-1.2 18.3h1.9L6.9 3.6H4.8z" />
          </svg>
          @SrTeb_
        </a>
        <span class="fg-pie-chip ue">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="17" fill="#003399" />
            <g fill="#FFCC00"><polygon v-for="(p, i) in stars" :key="i" :points="p" /></g>
          </svg>
          Hosted in Europe
        </span>
      </div>
    </div>
    <div class="fg-pie-abajo">
      <span>© {{ new Date().getFullYear() }} Tebby Services · Seguridad para comunidades de Minecraft</span>
      <a href="https://tebby.lgbt" target="_blank" rel="noopener noreferrer">tebby.lgbt</a>
    </div>
  </footer>
</template>

<style scoped>
.fg-pie {
  margin-top: 56px;
  padding: 26px 0 8px;
  border-top: 1px solid var(--rule);
  color: var(--ink-3);
  font-size: var(--text-xs);
}
.fg-pie.compacto { margin-top: 32px; }
.fg-pie-arriba { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.fg-pie-marca { display: flex; align-items: center; gap: 12px; color: var(--ink-2); font-size: 13px; font-weight: 500; }
.fg-pie-marca img { height: 30px; width: auto; opacity: .92; image-rendering: pixelated; }
.fg-pie-marca b { color: var(--ink); font-weight: 600; }
.fg-pie-marca .sep { color: var(--ink-3); }
.fg-pie-enlaces { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fg-pie-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--rule-2);
  border-radius: 99px;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 500;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.fg-pie-chip svg { width: 13px; height: 13px; }
a.fg-pie-chip:hover { color: var(--ink); border-color: var(--rule-3); background: var(--surface-2); }
.fg-pie-chip.ue { border-color: var(--rule); background: var(--surface); font-weight: 600; font-size: 11.5px; }
.fg-pie-chip.ue svg { width: 22px; height: 22px; }
.fg-pie-abajo {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--rule);
}
.fg-pie-abajo a:hover { color: var(--ink-2); }
</style>
