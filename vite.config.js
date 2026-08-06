import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/huobao-canvas',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      },
      '/v1': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      },
      '/public-assets': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  }
})
