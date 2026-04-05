import type { Anchor, AnchorCategory } from '~/types'
import { ANCHOR_MARKER_BG } from '~/utils/mapRouteColors'
import lucideSet from '@iconify-json/lucide/icons.json'

/** Lucide icon keys — map-friendly glyphs (cart / utensils match typical basemap POIs). */
const MARKER_ICON: Record<AnchorCategory, string> = {
  work: 'briefcase',
  school: 'graduation-cap',
  gym: 'dumbbell',
  grocery: 'shopping-cart',
  gas: 'fuel',
  pharmacy: 'pill',
  social: 'utensils-crossed',
  custom: 'map-pin',
}

type LucideJson = { icons: Record<string, { body: string }> }

function iconSvgInner(category: AnchorCategory): string {
  const icons = (lucideSet as LucideJson).icons
  const key = MARKER_ICON[category]
  const body = icons[key]?.body
  return body ?? icons['map-pin']!.body
}

export type AnchorMarkerDisplayOptions = {
  /** When false, only the colored pin is shown; name/address card appears when user enables “show all” or selects this pin. */
  showCard: boolean
  onPinActivate?: (e: MouseEvent) => void
}

function fillAnchorMarkerRoot(root: HTMLElement, a: Anchor, opts: AnchorMarkerDisplayOptions) {
  const color = ANCHOR_MARKER_BG[a.category]
  const { showCard, onPinActivate } = opts

  /**
   * Never assign `root.className = …` alone — Mapbox GL adds `mapboxgl-marker` and
   * `mapboxgl-marker-anchor-*` on the same node. Wiping those classes breaks transforms,
   * opacity, and anchoring (markers can vanish or misplace, often first for work/school).
   */
  const mapboxClasses = [...root.classList].filter((c) => c.startsWith('mapboxgl'))
  const layout = showCard
    ? 'flex max-w-[min(11rem,calc(100vw-2rem))] flex-col items-center gap-1 pointer-events-auto cursor-default select-none'
    : 'flex flex-col items-center gap-0 pointer-events-auto cursor-pointer select-none'
  root.className = [...mapboxClasses, layout].join(' ').trim()
  root.title = [a.name, a.addressSubtitle].filter(Boolean).join(' — ')
  root.dataset.anchorId = a.id
  root.replaceChildren()

  root.onclick = (e) => {
    e.stopPropagation()
    onPinActivate?.(e)
  }

  if (showCard) {
    const textBlock = document.createElement('div')
    textBlock.className =
      'max-w-full rounded-md bg-white/95 px-1.5 py-1 text-center shadow-sm ring-1 ring-black/10 dark:bg-zinc-900/95 dark:ring-white/10'

    const nameEl = document.createElement('div')
    nameEl.className =
      'text-[11px] font-bold leading-tight text-balance [text-shadow:0_0_8px_rgba(255,255,255,0.9)] dark:[text-shadow:0_0_10px_rgba(0,0,0,0.85)]'
    nameEl.style.color = color
    nameEl.textContent = a.name
    textBlock.appendChild(nameEl)

    if (a.addressSubtitle?.trim()) {
      const sub = document.createElement('div')
      sub.className =
        'mt-0.5 line-clamp-2 text-[9px] leading-snug text-zinc-600 dark:text-zinc-300'
      sub.textContent = a.addressSubtitle.trim()
      textBlock.appendChild(sub)
    }

    root.appendChild(textBlock)
  }

  const iconWrap = document.createElement('div')
  iconWrap.className =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-md ring-1 ring-black/20 dark:ring-white/20'
  iconWrap.style.backgroundColor = color

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '18')
  svg.setAttribute('height', '18')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.color = '#ffffff'
  svg.innerHTML = iconSvgInner(a.category)
  iconWrap.appendChild(svg)

  root.appendChild(iconWrap)
}

/**
 * DOM for a Mapbox HTML marker: optional label card above a colored pin; pin clicks call `onPinActivate`.
 */
export function buildAnchorMarkerElement(a: Anchor, opts: AnchorMarkerDisplayOptions): HTMLElement {
  const root = document.createElement('div')
  fillAnchorMarkerRoot(root, a, opts)
  return root
}

/** Refresh content on an existing marker element (same Mapbox Marker instance). */
export function syncAnchorMarkerDom(el: HTMLElement, a: Anchor, opts: AnchorMarkerDisplayOptions) {
  fillAnchorMarkerRoot(el, a, opts)
}
