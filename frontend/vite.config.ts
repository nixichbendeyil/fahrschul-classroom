import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Fahrschul Classroom',
        short_name: 'Classroom',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true
      }
    }
  }
})
