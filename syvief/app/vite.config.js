import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Site de projet GitHub Pages : https://billyjr2011.github.io/datasciencecoursera/
const BASE = '/datasciencecoursera/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: "SYVIEF — Vérification d'inventaire forestier",
        short_name: 'SYVIEF',
        description:
          "Vérification d'inventaires d'exploitation forestière avec scoring de conformité par réseau de neurones.",
        lang: 'fr',
        theme_color: '#0b1208',
        background_color: '#040905',
        display: 'standalone',
        orientation: 'any',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: { outDir: '../../docs', emptyOutDir: true, sourcemap: false },
});
