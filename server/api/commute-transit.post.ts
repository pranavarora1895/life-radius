type LatLng = { lat: number; lng: number }

function validPt(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  const lat = o.lat
  const lng = o.lng
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const key = String(config.public.googleMapsApiKey ?? '').trim()
  if (!key) {
    return { ok: false as const, error: 'NO_KEY' }
  }

  const body = await readBody(event).catch(() => null)
  if (!body?.origin || !body?.destination || !validPt(body.origin) || !validPt(body.destination)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid origin or destination' })
  }

  const departure = Math.floor(Date.now() / 1000)
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${body.origin.lat},${body.origin.lng}`)
  url.searchParams.set('destination', `${body.destination.lat},${body.destination.lng}`)
  url.searchParams.set('mode', 'transit')
  url.searchParams.set('departure_time', String(departure))
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  if (!res.ok) {
    return { ok: false as const, error: `HTTP_${res.status}` }
  }

  const data = (await res.json()) as {
    status: string
    routes?: Array<{ legs: Array<{ duration: { value: number } }>; overview_polyline?: { points: string } }>
    error_message?: string
  }

  if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
    return {
      ok: false as const,
      error: data.status,
      message: data.error_message,
    }
  }

  const route = data.routes[0]!
  const leg = route.legs[0]!
  return {
    ok: true as const,
    transitSeconds: leg.duration.value,
    polyline: route.overview_polyline?.points,
  }
})
