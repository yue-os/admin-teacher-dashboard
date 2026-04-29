import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/auth': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/teacher': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
