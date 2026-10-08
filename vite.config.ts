import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path';
import { readFileSync } from 'node:fs';
import { studioPlugin } from './scripts/studioPlugin';
import { buildVersion, versionPlugin } from './scripts/buildVersion';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const build = buildVersion(version);
  return {
  define: { __APP_BUILD__: JSON.stringify(build) },
  server: {
    ...(mode === 'studio' ? { host: '127.0.0.1', port: 5174, strictPort: true } : {}),
    proxy: { '/ws': { target: env.MULTIPLAYER_PROXY_TARGET || 'ws://127.0.0.1:3001', ws: true } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    versionPlugin(build),
    ...(mode === 'studio' ? [studioPlugin()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      // enregistré à la main dans main.tsx, seulement hors app native (Capacitor)
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        name: 'Find It',
        short_name: 'Find It',
        description: "Retrouve l'animal recherché parmi la foule !",
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1c0840',
        background_color: '#2d0d66',
        categories: ['games', 'kids'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tout le jeu (shell, images, sons) est pré-caché pour jouer hors ligne
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg,mp3,wav,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
};
})
