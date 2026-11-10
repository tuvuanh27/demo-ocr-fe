import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'DATALAB_', 'LLM_'],
  server: {
    proxy: {
      '/api-service': {
        target: 'https://www.datalab.to/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-service/, ''),
      },
    },
  },
})
