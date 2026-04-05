import lucideSet from '@iconify-json/lucide/icons.json'

type LucideJson = { icons: Record<string, { body: string }> }

function houseIconSvgInner(): string {
  const icons = (lucideSet as LucideJson).icons
  return icons.house?.body ?? icons['map-pin']!.body
}

/** Candidate home pin: house glyph on violet (matches route “home” emphasis). */
export function buildHomeMarkerElement(title: string): HTMLElement {
  const root = document.createElement('div')
  root.className =
    'flex flex-col items-center gap-1 pointer-events-none select-none'
  root.title = title

  const iconWrap = document.createElement('div')
  iconWrap.className =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-violet-600 shadow-lg ring-2 ring-violet-300/80 dark:ring-violet-400/50'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '18')
  svg.setAttribute('height', '18')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.color = '#ffffff'
  svg.innerHTML = houseIconSvgInner()
  iconWrap.appendChild(svg)

  root.appendChild(iconWrap)
  return root
}

export function syncHomeMarkerTitle(el: HTMLElement, title: string) {
  el.title = title
}
