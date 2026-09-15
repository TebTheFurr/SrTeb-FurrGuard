import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))
const shared = fileURLToPath(new URL('../shared', import.meta.url))

export default defineConfig({
  // index.php sirve dist/index.html en /admin/ y nginx publica dist/assets en /admin/assets/
  base: '/admin/',
  plugins: [
    vue(),
    // Iconos como componentes SVG compilados: solo se empaqueta cada icono importado.
    // Convención única de tamaños: pixelarticons a 24 px (clase `pi`, `x2` = 48 px) con bordes
    // nítidos; lucide a 16 px (clase `li`) solo para glifos funcionales pequeños.
    Icons({
      compiler: 'vue3',
      iconCustomizer(collection, _icon, props) {
        if (collection === 'pixelarticons') {
          props.width = '24'
          props.height = '24'
          props.class = 'pi'
          props['shape-rendering'] = 'crispEdges'
        } else {
          props.width = '16'
          props.height = '16'
          props.class = 'li'
        }
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': shared,
    },
    // shared/ vive fuera de admin/: sin dedupe, el `import 'vue'` de FgFooter.vue no se resolvería
    dedupe: ['vue'],
  },
  server: {
    fs: { allow: [root, shared] },
    proxy: {
      '/admin/api.php': 'http://127.0.0.1:8000',
      '/admin/callback.php': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // Sin data: URIs: todo sale como archivo en /admin/assets (la CSP no necesita `data:`)
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
