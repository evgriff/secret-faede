import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pwaEnabled = env.VITE_ENABLE_PWA !== 'false';

  return {
    plugins: [
      react(),
      ...(pwaEnabled
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              includeAssets: [
                'favicon.svg',
                'apple-touch-icon.png',
                'mask-icon.svg',
              ],
              manifest: {
                name: 'Secret Faeries',
                short_name: 'Faeries',
                description:
                  'A field-ready garden planner for plot edits, tasks, journal notes, and harvest logs.',
                theme_color: '#fffdf7',
                background_color: '#fffdf7',
                display: 'standalone',
                id: '/',
                start_url: '/',
                scope: '/',
                categories: ['productivity', 'lifestyle'],
                icons: [
                  {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                  {
                    src: '/maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
                shortcuts: [
                  {
                    name: 'Plan',
                    short_name: 'Plan',
                    url: '/app/plan',
                    icons: [
                      {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                      },
                    ],
                  },
                  {
                    name: 'Today',
                    short_name: 'Today',
                    url: '/app/today',
                    icons: [
                      {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                      },
                    ],
                  },
                  {
                    name: 'Feed',
                    short_name: 'Feed',
                    url: '/app/feed',
                    icons: [
                      {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                      },
                    ],
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                cleanupOutdatedCaches: true,
                navigateFallback: '/index.html',
                runtimeCaching: [
                  {
                    urlPattern: /\.(?:ico|png|svg)$/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'secret-faeries-app-assets',
                      expiration: {
                        maxAgeSeconds: 60 * 60 * 24 * 30,
                        maxEntries: 48,
                      },
                    },
                  },
                ],
              },
              devOptions: {
                enabled: false,
              },
            }),
          ]
        : []),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      testTimeout: 10_000,
      exclude: ['e2e/**', 'functions/**', 'node_modules/**', 'test/rules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: [
          'src/test/**',
          'e2e/**',
          'functions/**',
          'playwright.config.ts',
        ],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('vite/preload-helper')) {
              return 'vendor';
            }

            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('/@capacitor/')) {
              return 'capacitor-vendor';
            }

            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'firebase-vendor';
            }

            if (id.includes('/react') || id.includes('/scheduler/')) {
              return 'react-vendor';
            }

            return 'vendor';
          },
        },
      },
    },
  };
});
