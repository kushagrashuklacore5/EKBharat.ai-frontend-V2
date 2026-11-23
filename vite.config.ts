import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5501',
        changeOrigin: true,
      },
      // Vaani live-demo backend (Ai-Product/server.py — FastAPI on :8800).
      // Same-origin from the app, forwarded here, incl. the /stream WebSocket.
      '/vaani-api': {
        target: 'http://127.0.0.1:8800',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/vaani-api/, ''),
      },
      // Anti-cheat proctoring backend (Ai-Product/agent-1/backend — FastAPI on :8000).
      // The embedded tablet app streams webcam frames over /ws/proctor.
      '/ws': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // three.js is lazy-loaded for the hero only; its chunk is expected to be ~550 kB raw / ~135 kB gzip
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/@xyflow')) return 'xyflow'
          if (id.includes('node_modules/gsap')) return 'gsap'
          return undefined
        },
      },
    },
  },
})
