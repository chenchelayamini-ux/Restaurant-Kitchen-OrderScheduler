import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The production build is written straight into ../static so that Flask
// (`python app.py`) can serve the whole app from ONE port: http://localhost:5000
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Dev-mode convenience: `npm run dev` proxies API calls to the Flask server.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
