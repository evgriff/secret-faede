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
                name: 'Secret Faede',
                short_name: 'Faede',
                description: 'A small saved garden plot planner.',
                theme_color: '#edf3e7',
                background_color: '#edf3e7',
                display: 'standalone',
                start_url: '/',
                scope: '/',
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
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                cleanupOutdatedCaches: true,
                navigateFallback: 'index.html',
                runtimeCaching: [],
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
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: ['src/test/**', 'e2e/**', 'playwright.config.ts'],
      },
    },
  };
});
