/**
 * Mapbox HTTP helpers. Point NUXT_PUBLIC_MAPBOX_API_BASE at a Cloudflare Worker later to hide
 * the token server-side; if the Worker adds auth, omit NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN.
 */
import type { GeocodeFeature, LngLat, TravelMode } from '~/types'
import { bboxAroundKmString, haversineKm, lngLatFromCenter } from '~/utils/geo'

function appendToken(url: string, accessToken: string | undefined): string {
  if (!accessToken) return url
  const u = new URL(url)
  if (!u.searchParams.has('access_token')) {
    u.searchParams.set('access_token', accessToken)
  }
  return u.toString()
}

export async function forwardGeocode(
  query: string,
  apiBase: string,
  accessToken: string | undefined,
  options?: { limit?: number; proximity?: [number, number]; types?: string },
): Promise<GeocodeFeature[]> {
  const limit = options?.limit ?? 5
  const path = `/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  let url = `${apiBase.replace(/\/$/, '')}${path}?limit=${limit}`
  if (options?.proximity) {
    url += `&proximity=${options.proximity[0]},${options.proximity[1]}`
  }
  if (options?.types) {
    url += `&types=${encodeURIComponent(options.types)}`
  }
  url = appendToken(url, accessToken)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`)
  }
  const data = (await res.json()) as { features?: GeocodeFeature[] }
  return data.features ?? []
}

/** Single-line formatted place from coordinates (Mapbox reverse geocoding). */
export async function reverseGeocode(
  lngLat: LngLat,
  apiBase: string,
  accessToken: string | undefined,
): Promise<string | null> {
  const base = apiBase.replace(/\/$/, '')
  const path = `/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json`
  let url = `${base}${path}?limit=1`
  url = appendToken(url, accessToken)
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as { features?: Array<{ place_name?: string }> }
  const name = data.features?.[0]?.place_name
  return name?.trim() || null
}

const profileMap: Record<TravelMode, string> = {
  driving: 'mapbox/driving',
  walking: 'mapbox/walking',
  cycling: 'mapbox/cycling',
  /** No Mapbox transit profile — use pedestrian network for times; map overlay shows rail/ferry. */
  transit: 'mapbox/walking',
}

function directionsProfile(mode: TravelMode): string {
  if (mode === 'driving') return 'mapbox/driving-traffic'
  return profileMap[mode]
}

export interface RouteDetail {
  durationSeconds: number
  durationTypicalSeconds: number | null
  distanceMeters: number
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  congestedDurationFraction: number | null
  walkDetourFactor: number | null
}

function congestedFractionFromLeg(leg: {
  annotation?: { congestion?: string[]; duration?: number[] }
}): number | null {
  const ann = leg.annotation
  const cong = ann?.congestion
  const dur = ann?.duration
  if (!cong?.length || !dur?.length || cong.length !== dur.length) return null
  let heavy = 0
  let total = 0
  for (let i = 0; i < cong.length; i++) {
    const d = dur[i] ?? 0
    total += d
    const c = cong[i]
    if (c === 'moderate' || c === 'heavy' || c === 'severe') heavy += d
  }
  return total > 0 ? heavy / total : null
}

/**
 * Full route for map + scoring: geometry, duration (traffic-aware when driving), congestion breakdown.
 */
export async function getRouteDetail(
  home: { lng: number; lat: number },
  dest: { lng: number; lat: number },
  mode: TravelMode,
  apiBase: string,
  accessToken: string | undefined,
): Promise<RouteDetail> {
  const profile = directionsProfile(mode)
  const coords = `${home.lng},${home.lat};${dest.lng},${dest.lat}`
  const base = apiBase.replace(/\/$/, '')
  let url = `${base}/directions/v5/${profile}/${coords}?geometries=geojson&overview=full&annotations=congestion,duration,distance`
  url = appendToken(url, accessToken)
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Directions ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    routes?: Array<{
      duration: number
      duration_typical?: number
      distance: number
      geometry?: { type: string; coordinates: [number, number][] }
      legs?: Array<{ annotation?: { congestion?: string[]; duration?: number[] } }>
    }>
  }
  const route = data.routes?.[0]
  if (!route) throw new Error('No route returned')
  const geom = route.geometry
  if (geom?.type !== 'LineString' || !geom.coordinates?.length) {
    throw new Error('No route geometry')
  }
  const leg = route.legs?.[0]
  const congested =
    mode === 'driving' && profile === 'mapbox/driving-traffic' && leg
      ? congestedFractionFromLeg(leg)
      : null
  const typical =
    mode === 'driving' && typeof route.duration_typical === 'number' ? route.duration_typical : null

  const crowKm = haversineKm(
    { lng: home.lng, lat: home.lat },
    { lng: dest.lng, lat: dest.lat },
  )
  const routeKm = route.distance / 1000
  const walkDetourFactor =
    mode === 'transit' && crowKm > 0.001 ? Math.min(routeKm / crowKm, 5) : null

  return {
    durationSeconds: route.duration,
    durationTypicalSeconds: typical,
    distanceMeters: route.distance,
    geometry: { type: 'LineString', coordinates: geom.coordinates },
    congestedDurationFraction: congested,
    walkDetourFactor,
  }
}

export async function getRouteDurationSeconds(
  home: { lng: number; lat: number },
  dest: { lng: number; lat: number },
  mode: TravelMode,
  apiBase: string,
  accessToken: string | undefined,
): Promise<number> {
  const d = await getRouteDetail(home, dest, mode, apiBase, accessToken)
  return d.durationSeconds
}

function nearestAmong(home: LngLat, candidates: GeocodeFeature[]): GeocodeFeature | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestD = haversineKm(home, lngLatFromCenter(best.center))
  for (let i = 1; i < candidates.length; i++) {
    const f = candidates[i]
    const d = haversineKm(home, lngLatFromCenter(f.center))
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

type SearchBoxCategoryFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    name: string
    mapbox_id: string
    full_address?: string
    place_formatted?: string
    address?: string
  }
}

/** Address line under the venue name; avoids repeating `name` when Mapbox echoes it in `full_address`. */
function poiAddressSubtitle(
  p: SearchBoxCategoryFeature['properties'],
  venueName: string,
): string | undefined {
  const name = venueName.trim()
  const full = p.full_address?.trim()
  if (full) {
    if (full === name) return undefined
    const withComma = `${name}, `
    if (full.startsWith(withComma)) {
      const rest = full.slice(withComma.length).trim()
      return rest || undefined
    }
    if (full.startsWith(`${name} `) && full.length > name.length + 1) {
      return full.slice(name.length).trim()
    }
    if (!full.includes(name)) return full
    return full
  }
  const addr = p.address?.trim()
  const place = p.place_formatted?.trim()
  if (addr && place) return `${addr}, ${place}`
  if (addr) return addr
  if (place) return place
  return undefined
}

function searchBoxFeatureToGeocode(f: SearchBoxCategoryFeature): GeocodeFeature {
  const p = f.properties
  const venueName = p.name?.trim() || 'Place'
  let place_name = p.full_address?.trim()
  if (!place_name && p.address && p.place_formatted) {
    place_name = `${p.address}, ${p.place_formatted}`
  }
  if (!place_name) place_name = venueName
  const poiAddress = poiAddressSubtitle(p, venueName)
  return {
    id: p.mapbox_id,
    place_name,
    center: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
    poiName: venueName,
    poiAddress,
  }
}

/**
 * Mapbox Geocoding forward + types=poi no longer returns POIs reliably; Search Box category search does.
 * @see https://docs.mapbox.com/api/search/search-box/#category-search
 */
async function searchBoxCategory(
  canonicalCategoryId: string,
  home: LngLat,
  apiBase: string,
  accessToken: string | undefined,
  limit = 10,
): Promise<GeocodeFeature[]> {
  const base = apiBase.replace(/\/$/, '')
  const proximity = `${home.lng},${home.lat}`
  const bbox = bboxAroundKmString(home, 18)
  let url = `${base}/search/searchbox/v1/category/${encodeURIComponent(canonicalCategoryId)}?limit=${limit}&proximity=${encodeURIComponent(proximity)}&bbox=${encodeURIComponent(bbox)}`
  url = appendToken(url, accessToken)
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as { features?: SearchBoxCategoryFeature[] }
  const raw = data.features ?? []
  return raw.filter((x) => x?.geometry?.type === 'Point' && Array.isArray(x.geometry.coordinates)).map(searchBoxFeatureToGeocode)
}

/** How many grocery-type stops to score (closest first, within `GROCERY_MAX_DISTANCE_KM`). */
export const GROCERY_ANCHOR_CAP = 4
/** Straight-line radius: stores farther than this are excluded from the grocery set. */
export const GROCERY_MAX_DISTANCE_KM = 3.5

const GROCERY_CATEGORY_IDS = ['supermarket', 'grocery_store', 'convenience_store'] as const

/**
 * Closest grocery POIs from Search Box, deduped, within `maxDistanceKm`, up to `maxCount`.
 */
async function topGroceriesNearHome(
  home: LngLat,
  apiBase: string,
  accessToken: string | undefined,
  maxCount: number,
  maxDistanceKm: number,
): Promise<GeocodeFeature[]> {
  const searchLimit = 25
  const batches = await Promise.all(
    GROCERY_CATEGORY_IDS.map((id) => searchBoxCategory(id, home, apiBase, accessToken, searchLimit)),
  )
  const seen = new Set<string>()
  const merged: GeocodeFeature[] = []
  for (const arr of batches) {
    for (const f of arr) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      merged.push(f)
    }
  }
  return merged
    .map((f) => ({
      f,
      d: haversineKm(home, lngLatFromCenter(f.center)),
    }))
    .filter((x) => x.d <= maxDistanceKm)
    .sort((a, b) => a.d - b.d)
    .slice(0, maxCount)
    .map((x) => x.f)
}

async function nearestFromCategories(
  home: LngLat,
  categoryIds: string[],
  apiBase: string,
  accessToken: string | undefined,
): Promise<GeocodeFeature | null> {
  const batches = await Promise.all(categoryIds.map((id) => searchBoxCategory(id, home, apiBase, accessToken)))
  const merged: GeocodeFeature[] = []
  const seen = new Set<string>()
  for (const arr of batches) {
    for (const f of arr) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      merged.push(f)
    }
  }
  return nearestAmong(home, merged)
}

/**
 * Nearby POIs via Search Box: up to four closest groceries within `GROCERY_MAX_DISTANCE_KM`,
 * plus one each for gas, gym, social, pharmacy.
 */
export async function discoverNearbyPois(
  home: LngLat,
  apiBase: string,
  accessToken: string | undefined,
): Promise<{
  groceries: GeocodeFeature[]
  gas: GeocodeFeature | null
  gym: GeocodeFeature | null
  social: GeocodeFeature | null
  pharmacy: GeocodeFeature | null
}> {
  const [groceries, gas, gym, social, pharmacy] = await Promise.all([
    topGroceriesNearHome(home, apiBase, accessToken, GROCERY_ANCHOR_CAP, GROCERY_MAX_DISTANCE_KM),
    nearestFromCategories(home, ['gas_station'], apiBase, accessToken),
    nearestFromCategories(home, ['gym', 'fitness_center'], apiBase, accessToken),
    nearestFromCategories(home, ['restaurant', 'cafe', 'coffee', 'bar', 'pub'], apiBase, accessToken),
    nearestFromCategories(home, ['pharmacy', 'drugstore'], apiBase, accessToken),
  ])

  return { groceries, gas, gym, social, pharmacy }
}
