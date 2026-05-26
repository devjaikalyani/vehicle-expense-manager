import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'https://localhost:3001', changeOrigin: true, secure: false },
      '/uploads': { target: 'https://localhost:3001', changeOrigin: true, secure: false },
      '/socket.io': { target: 'https://localhost:3001', ws: true, changeOrigin: true, secure: false },
    },
  },
});
