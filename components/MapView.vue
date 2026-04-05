<script setup lang="ts">
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '~/constants/mapDefaults'
import { MAPBOX_TRAFFIC_ROAD_CLASSES } from '~/constants/mapTraffic'
import type { Anchor, AnchorCategory, LngLat, RouteOverlay, TravelMode } from '~/types'
import {
  buildAnchorMarkerElement,
  syncAnchorMarkerDom,
  type AnchorMarkerDisplayOptions,
} from '~/utils/anchorMapMarker'
import { buildHomeMarkerElement, syncHomeMarkerTitle } from '~/utils/homeMapMarker'
import { ROUTE_CATEGORY_LABEL, ROUTE_LINE_BY_CATEGORY } from '~/utils/mapRouteColors'

const ROUTE_SOURCE_ID = 'life-routes'
const ROUTE_LAYER_CASING_ID = 'life-routes-casing'
const ROUTE_LAYER_LINE_ID = 'life-routes-line'
const TRAFFIC_SOURCE_ID = 'life-traffic-v1'
const STREETS_SOURCE_ID = 'life-streets-v8'
const TRANSIT_LAYER_RAIL_ID = 'life-transit-rail'
const TRANSIT_LAYER_FERRY_ID = 'life-transit-ferry'
const TRANSIT_LAYER_BUS_GUIDEWAY_ID = 'life-transit-bus-guideway'
const TRANSIT_LAYER_BUS_STOPS_ID = 'life-transit-bus-stops'

export type MapPlacedSlots = { home: boolean; work: boolean; school: boolean }

type PickPromptState = { lngLat: LngLat; left: number; top: number }

const props = withDefaults(
  defineProps<{
    anchors: Anchor[]
    candidateHome: LngLat | null
    mapboxToken: string
    travelMode: TravelMode
    routeOverlays?: RouteOverlay[] | null
    showTrafficLayer?: boolean
    /** Rail, light rail, and ferry lines on the basemap. */
    showTransitLayer?: boolean
    /** When true, map is pan/zoom only (no click-to-set-home). */
    readOnly?: boolean
    /** Home / work / school already set elsewhere — those options stay disabled in the map picker. */
    placedSlots?: MapPlacedSlots
    /** Tooltip / accessible name for the home marker (e.g. formatted address). */
    homeMarkerHint?: string | null
    /**
     * Plan tab on narrow viewports: a fixed tab bar sits over the map. Offset the legend so
     * “Road traffic” stays visible (otherwise the top of the card sits under z-50 chrome).
     */
    underFixedTopUi?: boolean
  }>(),
  {
    routeOverlays: null,
    showTrafficLayer: true,
    showTransitLayer: true,
    readOnly: false,
    placedSlots: () => ({ home: false, work: false, school: false }),
    homeMarkerHint: null,
    underFixedTopUi: false,
  },
)

const legendRouteItems = computed(() => {
  const list = props.routeOverlays ?? []
  const seen = new Set<AnchorCategory>()
  const out: { label: string; color: string }[] = []
  for (const r of list) {
    if (seen.has(r.category)) continue
    seen.add(r.category)
    out.push({
      label: ROUTE_CATEGORY_LABEL[r.category],
      color: ROUTE_LINE_BY_CATEGORY[r.category],
    })
  }
  return out
})

/** Show whenever the user enables traffic — not only in Driving (map overlay is Driving-only). */
const trafficLegendVisible = computed(() => props.showTrafficLayer)

const transitLegendVisible = computed(() => props.showTransitLayer)

const showColorKey = computed(
  () => legendRouteItems.value.length > 0 || trafficLegendVisible.value || transitLegendVisible.value,
)

const showMapOverlays = computed(
  () => showColorKey.value || props.anchors.length > 0,
)

/** Pin labels: off by default; one at a time via click, or all via top-left toggle. */
const showAllAnchorCards = ref(false)
const selectedAnchorId = ref<string | null>(null)

function getAnchorMarkerOpts(a: Anchor): AnchorMarkerDisplayOptions {
  const showCard = showAllAnchorCards.value || selectedAnchorId.value === a.id
  return {
    showCard,
    onPinActivate: () => {
      if (showAllAnchorCards.value) return
      selectedAnchorId.value = selectedAnchorId.value === a.id ? null : a.id
      refreshAllAnchorMarkerDom()
    },
  }
}

function refreshAllAnchorMarkerDom() {
  if (!map) return
  for (const anchor of props.anchors) {
    const m = anchorMarkers.get(anchor.id)
    const el = m?.getElement()
    if (el) syncAnchorMarkerDom(el, anchor, getAnchorMarkerOpts(anchor))
  }
}

const emit = defineEmits<{
  placePick: [payload: { kind: 'home' | 'work' | 'school'; lngLat: LngLat }]
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const mapboxContainerRef = ref<HTMLDivElement | null>(null)
const pickPrompt = ref<PickPromptState | null>(null)
/** Narrow viewports need smaller fitBounds padding so routes stay visible without excessive zoom-out. */
const narrowScreen = ref(false)

function updateNarrowScreen() {
  if (typeof window === 'undefined') return
  narrowScreen.value = window.matchMedia('(max-width: 639px)').matches
}

function boundsFitPadding(): number {
  return narrowScreen.value ? 22 : 48
}
let map: mapboxgl.Map | null = null
let containerResizeObserver: ResizeObserver | null = null
const homeMarker = ref<mapboxgl.Marker | null>(null)
const anchorMarkers = new Map<string, mapboxgl.Marker>()
let onResize: (() => void) | null = null
let lifeLayersReady = false

function setAccessToken() {
  mapboxgl.accessToken = props.mapboxToken || ''
}

function emptyRouteCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function strokeForRoute(r: RouteOverlay): string {
  return ROUTE_LINE_BY_CATEGORY[r.category] ?? ROUTE_LINE_BY_CATEGORY.custom
}

function routeCollectionFromOverlays(overlays: RouteOverlay[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: overlays.map((r) => ({
      type: 'Feature' as const,
      properties: { stroke: strokeForRoute(r) },
      geometry: {
        type: 'LineString' as const,
        coordinates: r.coordinates,
      },
    })),
  }
}

function addTrafficLayers(m: mapboxgl.Map) {
  if (m.getSource(TRAFFIC_SOURCE_ID)) return
  m.addSource(TRAFFIC_SOURCE_ID, {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-traffic-v1',
  })
  /**
   * Streets-v12’s first `symbol` layer is ~index 36 (`tunnel-oneway-arrow-*`), so inserting
   * “before first symbol” leaves routes/traffic under almost all roads. Stack traffic near the
   * top (below routes, which we add after).
   */
  for (const cls of MAPBOX_TRAFFIC_ROAD_CLASSES) {
    const lid = `life-traffic-${cls}`
    m.addLayer({
      id: lid,
      type: 'line',
      source: TRAFFIC_SOURCE_ID,
      'source-layer': 'traffic',
      filter: ['==', ['get', 'class'], cls],
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 12, 2.5, 14, 4, 17, 7],
        /**
         * Traffic `congestion`: low | moderate | heavy | severe. Unknown / missing uses a
         * neutral slate so “clear” roads (low) read greener vs “no data”.
         */
        'line-color': [
          'match',
          ['get', 'congestion'],
          'low',
          '#22c55e',
          'moderate',
          '#eab308',
          'heavy',
          '#f97316',
          'severe',
          '#dc2626',
          '#a1a1aa',
        ],
        'line-opacity': [
          'match',
          ['get', 'congestion'],
          'low',
          0.75,
          'moderate',
          0.9,
          'heavy',
          0.92,
          'severe',
          0.95,
          0.45,
        ],
      },
    })
  }
}

function addTransitLayers(m: mapboxgl.Map) {
  if (m.getSource(STREETS_SOURCE_ID)) return
  m.addSource(STREETS_SOURCE_ID, {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8',
  })
  const before = ROUTE_LAYER_CASING_ID
  m.addLayer(
    {
      id: TRANSIT_LAYER_RAIL_ID,
      type: 'line',
      source: STREETS_SOURCE_ID,
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['major_rail', 'minor_rail']]],
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          'major_rail',
          '#818cf8',
          'minor_rail',
          '#c4b5fd',
          '#94a3b8',
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9,
          ['match', ['get', 'class'], 'major_rail', 1.4, 0.9],
          12,
          ['match', ['get', 'class'], 'major_rail', 2.8, 1.8],
          15,
          ['match', ['get', 'class'], 'major_rail', 4.5, 3],
        ],
        'line-opacity': 0.88,
      },
    },
    before,
  )
  m.addLayer(
    {
      id: TRANSIT_LAYER_FERRY_ID,
      type: 'line',
      source: STREETS_SOURCE_ID,
      'source-layer': 'road',
      filter: ['==', ['get', 'class'], 'ferry'],
      paint: {
        'line-color': '#22d3ee',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 2.8],
        'line-opacity': 0.85,
        'line-dasharray': [2, 1.5],
      },
    },
    before,
  )
  m.addLayer(
    {
      id: TRANSIT_LAYER_BUS_GUIDEWAY_ID,
      type: 'line',
      source: STREETS_SOURCE_ID,
      'source-layer': 'road',
      filter: ['==', ['get', 'type'], 'bus_guideway'],
      paint: {
        'line-color': '#fbbf24',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 14, 2.8, 17, 4.2],
        'line-opacity': 0.9,
      },
    },
    before,
  )
  m.addLayer(
    {
      id: TRANSIT_LAYER_BUS_STOPS_ID,
      type: 'circle',
      source: STREETS_SOURCE_ID,
      'source-layer': 'transit_stop_label',
      minzoom: 11,
      filter: ['==', ['get', 'mode'], 'bus'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 14, 4.5, 17, 6.5],
        'circle-color': '#fcd34d',
        'circle-opacity': 0.88,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#0f172a',
      },
    },
    before,
  )
}

function addRouteLayers(m: mapboxgl.Map) {
  if (m.getSource(ROUTE_SOURCE_ID)) return
  m.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: emptyRouteCollection(),
  })
  m.addLayer({
    id: ROUTE_LAYER_CASING_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 13, 11, 16, 14, 19, 18],
      'line-color': 'rgba(15, 23, 42, 0.72)',
      'line-opacity': 0.95,
      'line-blur': 0.4,
    },
  })
  m.addLayer({
    id: ROUTE_LAYER_LINE_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 13, 6.5, 16, 9, 19, 12],
      'line-opacity': 1,
      'line-color': ['get', 'stroke'],
    },
  })
}

function syncRouteSource() {
  if (!map?.getSource(ROUTE_SOURCE_ID)) return
  const src = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource
  const list = props.routeOverlays ?? []
  src.setData(list.length ? routeCollectionFromOverlays(list) : emptyRouteCollection())
}

function syncTrafficVisibility() {
  if (!map) return
  const vis =
    props.showTrafficLayer && props.travelMode === 'driving' ? 'visible' : 'none'
  for (const cls of MAPBOX_TRAFFIC_ROAD_CLASSES) {
    const lid = `life-traffic-${cls}`
    if (map.getLayer(lid)) {
      map.setLayoutProperty(lid, 'visibility', vis)
    }
  }
}

function syncTransitVisibility() {
  if (!map) return
  const vis = props.showTransitLayer ? 'visible' : 'none'
  for (const id of [
    TRANSIT_LAYER_RAIL_ID,
    TRANSIT_LAYER_FERRY_ID,
    TRANSIT_LAYER_BUS_GUIDEWAY_ID,
    TRANSIT_LAYER_BUS_STOPS_ID,
  ]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis)
    }
  }
}

function setupLifeLayers() {
  if (!map || lifeLayersReady) return
  addTrafficLayers(map)
  addRouteLayers(map)
  addTransitLayers(map)
  lifeLayersReady = true
  syncRouteSource()
  syncTrafficVisibility()
  syncTransitVisibility()
}

function removeLifeLayers() {
  if (!map) return
  if (map.getLayer(ROUTE_LAYER_LINE_ID)) map.removeLayer(ROUTE_LAYER_LINE_ID)
  if (map.getLayer(ROUTE_LAYER_CASING_ID)) map.removeLayer(ROUTE_LAYER_CASING_ID)
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID)
  for (const cls of MAPBOX_TRAFFIC_ROAD_CLASSES) {
    const lid = `life-traffic-${cls}`
    if (map.getLayer(lid)) map.removeLayer(lid)
  }
  if (map.getSource(TRAFFIC_SOURCE_ID)) map.removeSource(TRAFFIC_SOURCE_ID)
  if (map.getLayer(TRANSIT_LAYER_BUS_STOPS_ID)) map.removeLayer(TRANSIT_LAYER_BUS_STOPS_ID)
  if (map.getLayer(TRANSIT_LAYER_BUS_GUIDEWAY_ID)) map.removeLayer(TRANSIT_LAYER_BUS_GUIDEWAY_ID)
  if (map.getLayer(TRANSIT_LAYER_FERRY_ID)) map.removeLayer(TRANSIT_LAYER_FERRY_ID)
  if (map.getLayer(TRANSIT_LAYER_RAIL_ID)) map.removeLayer(TRANSIT_LAYER_RAIL_ID)
  if (map.getSource(STREETS_SOURCE_ID)) map.removeSource(STREETS_SOURCE_ID)
  lifeLayersReady = false
}

function boundsFromAnchors(): mapboxgl.LngLatBounds | null {
  const pts: LngLat[] = props.anchors.map((a) => a.lngLat)
  if (props.candidateHome) pts.push(props.candidateHome)
  if (pts.length === 0) return null
  const b = new mapboxgl.LngLatBounds(pts[0] as mapboxgl.LngLatLike, pts[0] as mapboxgl.LngLatLike)
  for (let i = 1; i < pts.length; i++) {
    b.extend(pts[i] as mapboxgl.LngLatLike)
  }
  return b
}

function extendBoundsWithRoutes(b: mapboxgl.LngLatBounds) {
  const overlays = props.routeOverlays ?? []
  for (const r of overlays) {
    for (const pair of r.coordinates) {
      b.extend(pair as mapboxgl.LngLatLike)
    }
  }
}

function syncAnchorMarkers() {
  if (!map) return
  const seen = new Set<string>()
  for (const a of props.anchors) {
    seen.add(a.id)
    let m = anchorMarkers.get(a.id)
    if (!m) {
      const el = buildAnchorMarkerElement(a, getAnchorMarkerOpts(a))
      m = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([a.lngLat.lng, a.lngLat.lat])
        .addTo(map)
      anchorMarkers.set(a.id, m)
    } else {
      m.setLngLat([a.lngLat.lng, a.lngLat.lat])
      const el = m.getElement()
      if (el) syncAnchorMarkerDom(el, a, getAnchorMarkerOpts(a))
    }
  }
  for (const [id, m] of anchorMarkers) {
    if (!seen.has(id)) {
      m.remove()
      anchorMarkers.delete(id)
    }
  }
}

const allPlacedSlotsFull = computed(
  () => props.placedSlots.home && props.placedSlots.work && props.placedSlots.school,
)

function layoutPickPrompt(pt: { x: number; y: number }): { left: number; top: number } {
  const el = wrapperRef.value
  const cw = el?.clientWidth ?? 0
  const ch = el?.clientHeight ?? 0
  const panelW = Math.min(200, Math.max(160, cw - 20))
  const panelH = 132
  const pad = 10
  const offsetY = 14
  let left = pt.x - panelW / 2
  let top = pt.y - panelH - offsetY
  left = Math.max(pad, Math.min(left, Math.max(pad, cw - panelW - pad)))
  top = Math.max(pad, Math.min(top, Math.max(pad, ch - panelH - pad)))
  return { left, top }
}

function openPickPrompt(lngLat: LngLat, screenPt: { x: number; y: number }) {
  const { left, top } = layoutPickPrompt(screenPt)
  pickPrompt.value = { lngLat, left, top }
}

function closePickPrompt() {
  pickPrompt.value = null
}

function onPickKind(kind: 'home' | 'work' | 'school') {
  const p = pickPrompt.value
  if (!p) return
  emit('placePick', { kind, lngLat: p.lngLat })
  closePickPrompt()
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePickPrompt()
}

watch(pickPrompt, (v: PickPromptState | null) => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onEscapeKey)
  if (v) window.addEventListener('keydown', onEscapeKey)
})

function syncHomeMarker() {
  if (!map) return
  if (!props.candidateHome) {
    homeMarker.value?.remove()
    homeMarker.value = null
    return
  }
  const ll: [number, number] = [props.candidateHome.lng, props.candidateHome.lat]
  const title = props.homeMarkerHint?.trim() || 'Candidate home'
  if (!homeMarker.value) {
    const el = buildHomeMarkerElement(title)
    homeMarker.value = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(ll).addTo(map)
  } else {
    homeMarker.value.setLngLat(ll)
    const el = homeMarker.value.getElement()
    if (el) syncHomeMarkerTitle(el, title)
  }
}

onMounted(async () => {
  await nextTick()
  if (!mapboxContainerRef.value || !props.mapboxToken) return
  updateNarrowScreen()
  setAccessToken()
  const initial = boundsFromAnchors()
  const initialStyle = 'mapbox://styles/mapbox/streets-v12' as const
  const mapOptions = {
    container: mapboxContainerRef.value,
    style: initialStyle,
    /** Keeps the map 2D on touch: no accidental pitch/rotate while panning. */
    touchPitchRotate: false,
    dragRotate: false,
  } as const
  if (initial) {
    map = new mapboxgl.Map({
      ...mapOptions,
      bounds: initial,
      fitBoundsOptions: { padding: boundsFitPadding(), maxZoom: 13 },
    })
  } else {
    map = new mapboxgl.Map({
      ...mapOptions,
      center: [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat],
      zoom: DEFAULT_MAP_ZOOM,
    })
  }
  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
    'top-right',
  )
  map.on('click', (e) => {
    selectedAnchorId.value = null
    refreshAllAnchorMarkerDom()
    if (props.readOnly) return
    if (allPlacedSlotsFull.value) return
    const lngLat: LngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat }
    const screenPt = map!.project([lngLat.lng, lngLat.lat])
    openPickPrompt(lngLat, screenPt)
  })
  map.on('load', () => {
    setupLifeLayers()
    syncAnchorMarkers()
    syncHomeMarker()
  })
  onResize = () => {
    updateNarrowScreen()
    map?.resize()
  }
  window.addEventListener('resize', onResize)
  if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
    containerResizeObserver = new ResizeObserver(onResize)
    containerResizeObserver.observe(wrapperRef.value)
  }
})

watch(
  () => props.anchors,
  (list) => {
    if (selectedAnchorId.value && !list.some((x) => x.id === selectedAnchorId.value)) {
      selectedAnchorId.value = null
    }
    syncAnchorMarkers()
    if (map && props.anchors.length) {
      const b = boundsFromAnchors()
      if (b) map.fitBounds(b, { padding: boundsFitPadding(), maxZoom: 13 })
    }
  },
  { deep: true },
)

watch(showAllAnchorCards, () => {
  refreshAllAnchorMarkerDom()
})

watch(
  () => [props.candidateHome, props.homeMarkerHint] as const,
  () => {
    syncHomeMarker()
  },
  { deep: true },
)

watch(
  () => [props.anchors.length, props.candidateHome] as const,
  () => {
    if (!map) return
    if (props.anchors.length === 0 && !props.candidateHome) {
      map.easeTo({
        center: [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat],
        zoom: DEFAULT_MAP_ZOOM,
        duration: 500,
      })
    }
  },
)

watch(
  () => props.routeOverlays,
  () => {
    if (!map?.isStyleLoaded()) return
    setupLifeLayers()
    syncRouteSource()
    if (map && (props.routeOverlays?.length ?? 0) > 0) {
      const b = boundsFromAnchors()
      if (b && props.candidateHome) {
        extendBoundsWithRoutes(b)
        map.fitBounds(b, {
          padding: narrowScreen.value ? 28 : 56,
          maxZoom: 14,
          duration: 600,
        })
      }
    }
  },
  { deep: true },
)

watch(
  () => [props.showTrafficLayer, props.travelMode] as const,
  () => {
    // Do not use `map.isStyleLoaded()`: `style.loaded()` stays false while any source
    // (including traffic tiles) is still fetching, so toggling traffic would often no-op.
    if (!map || !lifeLayersReady) return
    syncTrafficVisibility()
  },
)

watch(
  () => props.showTransitLayer,
  () => {
    if (!map || !lifeLayersReady) return
    syncTransitVisibility()
  },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onEscapeKey)
  }
  containerResizeObserver?.disconnect()
  containerResizeObserver = null
  if (onResize) window.removeEventListener('resize', onResize)
  homeMarker.value?.remove()
  for (const m of anchorMarkers.values()) m.remove()
  anchorMarkers.clear()
  removeLifeLayers()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950/40">
    <ClientOnly>
      <div v-if="!mapboxToken" class="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-400">
        <Icon name="lucide:map-pin-off" class="size-10 text-cyan-500/40" aria-hidden="true" />
        <p class="font-medium text-slate-200">Map couldn’t load</p>
        <p class="max-w-sm text-slate-500">
          Refresh the page or try again in a moment. If this keeps happening, the person who published this app may need
          to finish map setup.
        </p>
      </div>
      <div v-else ref="wrapperRef" class="absolute inset-0 h-full w-full touch-manipulation">
        <div ref="mapboxContainerRef" class="absolute inset-0 h-full w-full" />
      </div>
      <div
        v-if="pickPrompt && mapboxToken && !readOnly"
        class="pointer-events-auto absolute z-20 min-w-0 max-w-[min(200px,calc(100vw-2.5rem))] rounded-lg border border-cyan-500/30 bg-slate-900/95 p-2.5 shadow-xl shadow-black/50 backdrop-blur-md"
        role="dialog"
        aria-label="Choose place type"
        :style="{ left: `${pickPrompt.left}px`, top: `${pickPrompt.top}px` }"
        @click.stop
      >
        <p class="text-[11px] font-medium text-slate-100">Add this point as</p>
        <div class="mt-2 flex flex-col gap-1.5">
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition enabled:hover:bg-violet-50 enabled:dark:hover:bg-violet-950/50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="placedSlots.home"
            @click="onPickKind('home')"
          >
            Home
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition enabled:hover:bg-sky-50 enabled:dark:hover:bg-sky-950/50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="placedSlots.work"
            @click="onPickKind('work')"
          >
            Work
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition enabled:hover:bg-amber-50 enabled:dark:hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="placedSlots.school"
            @click="onPickKind('school')"
          >
            School
          </button>
        </div>
        <button
          type="button"
          class="mt-2 w-full rounded-md border border-slate-600 py-1 text-[11px] text-slate-400 hover:bg-slate-800/80"
          @click="closePickPrompt"
        >
          Cancel
        </button>
      </div>
      <template #fallback>
        <div class="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
          <Icon name="lucide:loader-circle" class="size-8 animate-spin text-cyan-500/80" aria-hidden="true" />
          Loading map…
        </div>
      </template>
    </ClientOnly>
    <div
      v-if="mapboxToken && showMapOverlays"
      class="pointer-events-none absolute left-1 z-30 flex w-[min(100%,calc(100vw-0.5rem),16rem)] flex-col gap-1.5 sm:left-2 sm:max-w-[min(100%,calc(100vw-1rem),18rem)] sm:gap-2"
      :class="
        underFixedTopUi
          ? 'top-1 max-lg:top-[calc(env(safe-area-inset-top)+8.5rem)] lg:top-2'
          : 'top-1 sm:top-2'
      "
    >
      <div
        v-if="showColorKey"
        class="pointer-events-auto rounded-lg border border-cyan-500/25 bg-slate-900/95 px-2 py-1.5 text-left shadow-lg shadow-black/30 backdrop-blur-md sm:px-2.5 sm:py-2"
      >
        <p class="text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px]">
          Color key
        </p>
        <!-- Traffic first so it stays visible when route list is long -->
        <div
          v-if="trafficLegendVisible"
          class="mt-1 border-t border-slate-700 pt-1 sm:mt-1.5 sm:pt-1.5"
        >
          <p class="text-[9px] font-semibold text-slate-200 sm:text-[10px]">Road traffic (congestion)</p>
          <p
            v-if="travelMode !== 'driving'"
            class="mt-0.5 text-[8px] leading-snug text-amber-200/90 sm:text-[9px]"
          >
            Colored roads appear on the map in <span class="font-medium">Driving</span> mode (overlay is off for walk / bike / transit).
          </p>
          <div
            class="mt-1 grid grid-cols-1 gap-y-0.5 text-[9px] text-slate-200 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-1 sm:text-[10px]"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-green-500" />
              <span class="min-w-0">Low</span>
            </span>
            <span class="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-yellow-500" />
              <span class="min-w-0">Moderate</span>
            </span>
            <span class="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-orange-500" />
              <span class="min-w-0">Heavy</span>
            </span>
            <span class="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-red-600" />
              <span class="min-w-0">Severe</span>
            </span>
            <span class="flex min-w-0 items-center gap-1.5 text-slate-400 sm:col-span-2">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-zinc-400" />
              <span class="min-w-0">No data / other</span>
            </span>
          </div>
        </div>
        <div
          v-if="legendRouteItems.length"
          class="mt-1.5 space-y-0.5 border-t border-slate-700 pt-1.5 sm:mt-2 sm:space-y-1 sm:pt-2"
        >
          <p class="text-[9px] text-slate-500 sm:text-[10px]">
            <span class="sm:hidden">Routes</span>
            <span class="hidden sm:inline">Routes (home → stop)</span>
          </p>
          <div
            v-for="item in legendRouteItems"
            :key="item.label"
            class="flex min-w-0 items-center gap-2"
          >
            <span
              class="h-2.5 w-6 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10"
              :style="{ backgroundColor: item.color }"
            />
            <span class="min-w-0 break-words text-[10px] font-medium leading-snug text-slate-100 sm:text-[11px]">{{ item.label }}</span>
          </div>
        </div>
        <div
          v-if="transitLegendVisible"
          class="mt-1.5 border-t border-slate-700 pt-1.5 sm:mt-2 sm:pt-2"
        >
          <p class="text-[9px] text-slate-500 sm:text-[10px]">Transit lines</p>
          <p
            class="mt-0.5 text-[8px] leading-tight text-slate-500 sm:text-[9px]"
            title="Rail, ferries, bus lanes, and major stops—not every local bus route, and not live vehicle positions. Your pins and routes draw on top."
          >
            Guide only · not every line · not live vehicles
          </p>
          <div class="mt-1 space-y-0.5 text-[9px] text-slate-300 sm:space-y-1 sm:text-[10px]">
            <span class="flex items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-indigo-400" />
              <span class="leading-tight">Commuter rail</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-violet-300" />
              <span class="leading-tight">Light rail</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                class="inline-block h-2 w-4 shrink-0 rounded-sm border border-dashed border-cyan-400/90 bg-cyan-950/50"
              />
              Ferry
            </span>
            <span class="flex items-center gap-1.5">
              <span aria-hidden="true" class="inline-block h-2 w-4 shrink-0 rounded-sm bg-amber-400" />
              <span class="leading-tight">Bus lanes</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span aria-hidden="true" class="inline-block size-2 shrink-0 rounded-full bg-amber-300 ring-1 ring-slate-900" />
              <span class="leading-tight">Bus stops</span>
            </span>
          </div>
        </div>
        <p class="mt-1.5 border-t border-slate-700 pt-1 text-[8px] leading-tight text-slate-500 sm:mt-2 sm:pt-1.5 sm:text-[10px]">
          Violet pin = home
        </p>
      </div>
      <div
        v-if="anchors.length > 0"
        class="pointer-events-auto rounded-lg border border-cyan-500/25 bg-slate-900/95 px-2 py-1.5 text-left shadow-lg shadow-black/30 backdrop-blur-md sm:px-2.5 sm:py-2"
      >
        <label class="flex cursor-pointer items-start gap-1.5 sm:gap-2">
          <input
            v-model="showAllAnchorCards"
            type="checkbox"
            class="mt-0.5 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0"
          />
          <span class="text-[10px] font-medium leading-snug text-slate-100 sm:text-[11px]">
            Show all place labels
          </span>
        </label>
        <p class="mt-1 pl-5 text-[8px] leading-tight text-slate-500 sm:mt-1.5 sm:pl-6 sm:text-[10px] sm:leading-snug">
          <span class="sm:hidden">Tap a pin for name · map to hide</span>
          <span class="hidden sm:inline">When off, click a colored pin to show its name and address; click the map to hide it again.</span>
        </p>
      </div>
    </div>
    <p
      v-if="mapboxToken"
      class="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-2 right-2 max-w-none rounded-md border border-slate-700/80 bg-slate-950/90 px-2 py-1 text-[10px] leading-tight text-slate-400 shadow-lg shadow-black/40 backdrop-blur-sm sm:left-3 sm:right-auto sm:max-w-[min(100%,18rem)] sm:py-1.5 sm:text-[11px] sm:leading-snug"
    >
      <template v-if="readOnly">
        <span class="sm:hidden">View only · edit on Plan &amp; map</span>
        <span class="hidden sm:inline">View only — change home on Plan &amp; map. Route colors match stop type; use the color key for traffic (driving) and transit lines when those overlays are on.</span>
      </template>
      <template v-else-if="allPlacedSlotsFull">
        <span class="sm:hidden">All places set · clear one in Locations to add from map</span>
        <span class="hidden sm:inline">Home, work, and school are set. Clear one in Locations to add from the map again. Route colors match stop type; overlays for traffic and transit use the key above when enabled.</span>
      </template>
      <template v-else>
        <span class="sm:hidden">Tap map to set home, work, school (once each)</span>
        <span class="hidden sm:inline">Click the map to add home, work, or school (each once). Route colors match stop type; traffic and transit overlays use the key above when enabled on Plan &amp; map.</span>
      </template>
    </p>
  </div>
</template>
