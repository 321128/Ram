import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    proxy: {
      '/public': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
      '/manifest': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
      '/current': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
      '/update': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5174',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
