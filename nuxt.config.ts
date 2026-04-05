// https://nuxt.com/docs/api/configuration/nuxt-config
// Build output: `dist/` (cloudflare-pages preset). Deploy with `npx wrangler pages deploy dist`, not `wrangler deploy`.
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  app: {
    head: {
      htmlAttrs: {
        class: 'dark',
      },
    },
  },
  devtools: { enabled: true },
  /** Default `true` in recent Nuxt; client Vite can fail to resolve `#app-manifest` during dev. */
  experimental: {
    appManifest: false,
  },
  vite: {
    resolve: {
      alias: {
        '#app-manifest': fileURLToPath(new URL('./stubs/app-manifest.mjs', import.meta.url)),
      },
    },
  },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'cloudflare-pages',
  },
  tailwindcss: {
    config: {
      darkMode: 'class',
    },
  },
  runtimeConfig: {
    public: {
      mapboxAccessToken: '',
      mapboxApiBase: 'https://api.mapbox.com',
      /** Optional: server-side transit directions (Transit mode scoring); map stays Mapbox-only. */
      googleMapsApiKey: '',
    },
  },
})
