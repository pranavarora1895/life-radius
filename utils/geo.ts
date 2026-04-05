import type { LngLat } from '~/types'

/** Great-circle distance in kilometers (for picking nearest POI). */
export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function lngLatFromCenter(center: [number, number]): LngLat {
  return { lng: center[0], lat: center[1] }
}

/** Bounding box string for Mapbox: minLon,minLat,maxLon,maxLat (~square, `radiusKm` from center). */
export function bboxAroundKmString(center: LngLat, radiusKm: number): string {
  const latDelta = radiusKm / 111
  const cosLat = Math.cos((center.lat * Math.PI) / 180)
  const lngDelta = cosLat > 0.01 ? radiusKm / (111 * cosLat) : latDelta
  const minLon = center.lng - lngDelta
  const maxLon = center.lng + lngDelta
  const minLat = center.lat - latDelta
  const maxLat = center.lat + latDelta
  return `${minLon},${minLat},${maxLon},${maxLat}`
}
