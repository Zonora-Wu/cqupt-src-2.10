import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3001'
const usePolling = process.env.VITE_USE_POLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined
          if (id.includes('/node_modules/three/') || id.includes('/node_modules/@react-three/')) {
            return 'vendor-three'
          }
          if (id.includes('/node_modules/motion/') || id.includes('/node_modules/framer-motion/')) {
            return 'vendor-motion'
          }
          if (id.includes('/node_modules/socket.io-client/') || id.includes('/node_modules/engine.io-client/')) {
            return 'vendor-realtime'
          }
          if (
            id.includes('/node_modules/react/')
            || id.includes('/node_modules/react-dom/')
            || id.includes('/node_modules/react-router/')
            || id.includes('/node_modules/react-router-dom/')
          ) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        target: apiProxyTarget,
      },
      '/socket.io': {
        changeOrigin: true,
        target: apiProxyTarget,
        ws: true,
      },
    },
    watch: usePolling ? { interval: 250, usePolling: true } : undefined,
  },
})
