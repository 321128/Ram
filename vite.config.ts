import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') {
            return 'frontx/sw.js';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
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
