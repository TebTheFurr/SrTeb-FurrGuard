import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/admin/api.php': 'http://localhost:80',
      '/admin/callback.php': 'http://localhost:80',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.5.0'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
