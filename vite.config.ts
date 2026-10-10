import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path';
import { readFileSync } from 'node:fs';
import { studioPlugin } from './scripts/studioPlugin';
import { buildVersion, versionPlugin } from './scripts/buildVersion';
import { shareMetadataPlugin } from './scripts/shareMetadataPlugin';

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
    shareMetadataPlugin(env.VITE_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')),
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
        // Shell, sons et portraits de jeu compressés : tous les chapitres publiés hors ligne.
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg,mp3,wav,ico,woff2}'],
        globIgnores: ['assets/images/characters/{animals,people,history,celebrities}/*.png'],
        // Les PNG512 de la fiche album arrivent uniquement lorsqu'on ouvre un portrait.
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/assets\/images\/characters\/(animals|people|history|celebrities)\/[a-z0-9-]+\.png$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'find-it-portrait-details-v1', expiration: { maxEntries: 48, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } },
        }],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
};
})
