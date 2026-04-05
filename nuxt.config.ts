// https://nuxt.com/docs/api/configuration/nuxt-config
// Build output: `dist/` (cloudflare-pages preset). Deploy: `npm run pages:deploy` (Pages) or `npm run worker:deploy` (Workers + assets; see wrangler.jsonc).
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
    hooks: {
      /** Cloudflare Workers Assets: ignore worker bundle & Pages metadata in ./dist (see wrangler.jsonc `assets.directory`). */
      async compiled(nitro) {
        const dir = nitro.options.output.dir
        const { join } = await import('node:path')
        const { writeFile } = await import('node:fs/promises')
        const lines = ['_worker.js', '_redirects', '_headers', '_routes.json', 'nitro.json']
        await writeFile(join(dir, '.assetsignore'), `${lines.join('\n')}\n`, 'utf8')
      },
    },
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
