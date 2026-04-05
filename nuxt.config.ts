// https://nuxt.com/docs/api/configuration/nuxt-config
// Build output: `dist/` (cloudflare-pages preset). Deploy: `npm run pages:deploy` (Pages) or `npm run worker:deploy` (Workers + assets; see wrangler.jsonc).
import { fileURLToPath } from 'node:url'
import { SITE_DESCRIPTION, SITE_TITLE } from './constants/seo'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-15',
  app: {
    head: {
      title: SITE_TITLE,
      htmlAttrs: {
        class: 'dark',
        lang: 'en',
      },
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        { name: 'description', content: SITE_DESCRIPTION },
        { name: 'application-name', content: 'Life Radius' },
        { name: 'author', content: 'Life Radius' },
        { name: 'robots', content: 'index, follow' },
        { name: 'theme-color', content: '#020617' },
        { name: 'color-scheme', content: 'dark' },
        { property: 'og:title', content: SITE_TITLE },
        { property: 'og:description', content: SITE_DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Life Radius' },
        { property: 'og:locale', content: 'en_US' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: SITE_TITLE },
        { name: 'twitter:description', content: SITE_DESCRIPTION },
      ],
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
