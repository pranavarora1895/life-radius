# Life Radius

A [Nuxt 3](https://nuxt.com/) app that scores how well a **candidate home** works with your **work** and **school** locations. Pick places on the map or search by address, choose a travel mode (driving, walking, cycling, transit), and compare up to three plans side by side.

Maps and routing use **Mapbox**. An optional **Google Maps** API key enables richer transit overlays and walk-vs-transit comparison in transit mode.

## Features

- Interactive **Mapbox GL** map with home, work, and school placement
- **Life score** from commute routes, nearby POIs, and trip-frequency modeling
- Multiple **plans** with labels and a **compare** view
- Optional **traffic** and **transit** layers where supported

## Tech stack

- Vue 3 · Nuxt 3 · TypeScript · Tailwind CSS
- Mapbox GL · Iconify (Lucide)

## Prerequisites

- Node.js 18+ (20+ recommended)
- A [Mapbox access token](https://account.mapbox.com/)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your keys:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Purpose |
   |----------|----------|---------|
   | `NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox maps and Directions API |
   | `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Transit directions / overlay in transit mode |
   | `NUXT_PUBLIC_MAPBOX_API_BASE` | No | Defaults to `https://api.mapbox.com`; use a proxy URL if you deploy one |

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open the URL shown in the terminal (usually `http://localhost:3000`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (Nitro output in `.output/`) |
| `npm run preview` | Preview production build locally |
| `npm run generate` | Static generation (if you configure prerendering) |

## Deployment

The project is configured for **Cloudflare Pages** via `nitro.preset: 'cloudflare-pages'` in `nuxt.config.ts`. Build with `npm run build` and deploy the `.output/` directory according to [Nuxt’s Cloudflare guide](https://nuxt.com/deploy/cloudflare), or point your host at the same preset.

Set the same `NUXT_PUBLIC_*` variables in your hosting provider’s environment (never commit `.env`).

## License

Private / all rights reserved unless you add an open-source license.
