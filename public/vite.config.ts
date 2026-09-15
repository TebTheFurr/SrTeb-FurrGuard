import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))
const shared = fileURLToPath(new URL('../shared/ui', import.meta.url))

export default defineConfig({
  // nginx sirve /public/assets/ desde public/dist/assets/
  base: '/public/',
  // ~icons/<set>/<nombre>: cada icono importado se compila a un componente SVG, sin runtime
  plugins: [vue(), Icons({ compiler: 'vue3' })],
  resolve: {
    alias: { '@': src, '@shared': shared },
    // FgFooter.vue vive fuera de este paquete: su import de 'vue' debe resolver aquí
    dedupe: ['vue'],
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), shared] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // nada de data: URIs: la CSP solo permite recursos del propio origen
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
