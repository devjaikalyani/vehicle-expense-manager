import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const redirectToBase = {
  name: 'redirect-to-base',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '' || req.url === '/m') {
        res.writeHead(302, { Location: '/m/' });
        res.end();
      } else {
        next();
      }
    });
  },
};

export default defineConfig({
  base: '/m/',
  plugins: [
    react(),
    redirectToBase,
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifest: {
        name: 'VEM Field',
        short_name: 'VEM Field',
        description: 'Log your trips and expenses',
        theme_color: '#1e40af',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '/m/',
        scope: '/m/',
        icons: [
          { src: '/m/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/m/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: {
    host: true,
    port: 5174,
    https: {
      cert: '../192.168.10.215+2.pem',
      key: '../192.168.10.215+2-key.pem',
    },
    proxy: {
      '/api': { target: 'https://localhost:3001', changeOrigin: true, secure: false },
      '/uploads': { target: 'https://localhost:3001', changeOrigin: true, secure: false },
    },
  },
  build: {
    outDir: '../server/mobile-dist',
    emptyOutDir: true,
  },
});
