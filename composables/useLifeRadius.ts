import { chooseWalkOrTransit } from '~/utils/commuteChoice'
import { decodeGooglePolyline } from '~/utils/decodeGooglePolyline'
import { discoverNearbyPois, getRouteDetail, reverseGeocode, type RouteDetail } from '~/utils/mapboxApi'
import { lngLatFromCenter } from '~/utils/geo'
import { insightForTravelMode } from '~/utils/scoreExplain'
import { estimateYearlyTravelMinutes, rescoreKeepingRouteErrors, scoreFromRoutes } from '~/utils/scoring'
import type {
  Anchor,
  AnchorTrafficSummary,
  LifeScenario,
  LngLat,
  NamedPlace,
  RouteOverlay,
  ScoreResult,
  TravelMode,
} from '~/types'

const MAX_SCENARIOS = 3

type RouteCalcResult = {
  id: string
  minutes: number | null
  err?: string
  detail?: RouteDetail
  overlayCoords?: [number, number][]
  chosenSeconds?: number
  transitSec?: number | null
  commuteMode?: 'walk' | 'transit'
  commuteNote?: string
}

type ScenarioInternal = LifeScenario & {
  rebuildSeq: number
  debounceTimer: ReturnType<typeof setTimeout> | null
  homeGeocodeSeq: number
  workGeocodeSeq: number
  schoolGeocodeSeq: number
}

function newScenarioId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createEmptyScenario(ordinal: number): ScenarioInternal {
  return {
    id: newScenarioId(),
    label: `Scenario ${ordinal}`,
    candidateHome: null,
    candidateHomeLabel: null,
    candidateHomeAddress: null,
    workPlace: null,
    schoolPlace: null,
    travelMode: 'driving',
    anchors: [],
    scoreResult: null,
    calculating: false,
    calculateError: null,
    discoveringPois: false,
    poiDiscoverError: null,
    showTrafficLayer: true,
    showTransitLayer: true,
    rebuildSeq: 0,
    debounceTimer: null,
    homeGeocodeSeq: 0,
    workGeocodeSeq: 0,
    schoolGeocodeSeq: 0,
  }
}

const scenarios = ref<ScenarioInternal[]>([createEmptyScenario(1)])
const activeScenarioId = ref<string>(scenarios.value[0]!.id)

function findScenarioIndex(id: string): number {
  return scenarios.value.findIndex((s) => s.id === id)
}

function getScenario(id: string): ScenarioInternal | undefined {
  return scenarios.value.find((s) => s.id === id)
}

function activeScenario(): ScenarioInternal | undefined {
  const id = activeScenarioId.value
  let s = getScenario(id)
  if (!s && scenarios.value.length) {
    s = scenarios.value[0]
    activeScenarioId.value = s!.id
  }
  return s
}

export function useLifeRadius() {
  const config = useRuntimeConfig()

  const active = computed(() => activeScenario())

  const anchors = computed({
    get: () => active.value?.anchors ?? [],
    set: (v: Anchor[]) => {
      const s = active.value
      if (s) s.anchors = v
    },
  })

  const candidateHome = computed(() => active.value?.candidateHome ?? null)
  const candidateHomeLabel = computed(() => active.value?.candidateHomeLabel ?? null)
  const candidateHomeAddress = computed(() => active.value?.candidateHomeAddress ?? null)
  const workPlace = computed(() => active.value?.workPlace ?? null)
  const schoolPlace = computed(() => active.value?.schoolPlace ?? null)
  const travelMode = computed({
    get: () => active.value?.travelMode ?? 'driving',
    set: (m: TravelMode) => {
      const s = active.value
      if (s) s.travelMode = m
    },
  })
  const scoreResult = computed(() => active.value?.scoreResult ?? null)
  const calculating = computed(() => active.value?.calculating ?? false)
  const calculateError = computed(() => active.value?.calculateError ?? null)
  const discoveringPois = computed(() => active.value?.discoveringPois ?? false)
  const poiDiscoverError = computed(() => active.value?.poiDiscoverError ?? null)
  const showTrafficLayer = computed({
    get: () => active.value?.showTrafficLayer ?? true,
    set: (on: boolean) => {
      const s = active.value
      if (s) s.showTrafficLayer = on
    },
  })
  const showTransitLayer = computed({
    get: () => active.value?.showTransitLayer ?? true,
    set: (on: boolean) => {
      const s = active.value
      if (s) s.showTransitLayer = on
    },
  })

  async function rebuildAnchorsForScenario(scenarioId: string) {
    const s = getScenario(scenarioId)
    if (!s) return

    const mySeq = ++s.rebuildSeq
    const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'
    const token = (config.public.mapboxAccessToken as string) || undefined
    const home = s.candidateHome

    const prevById = new Map(s.anchors.map((a) => [a.id, a]))
    function carryTrips(id: string): Pick<Anchor, 'roundTripsPerWeek'> {
      const p = prevById.get(id)
      if (p?.roundTripsPerWeek == null) return {}
      return { roundTripsPerWeek: p.roundTripsPerWeek }
    }

    const list: Anchor[] = []

    if (s.workPlace) {
      const w = s.workPlace
      list.push({
        id: 'place-work',
        name: w.label,
        addressSubtitle: w.address?.trim() || undefined,
        category: 'work',
        lngLat: { ...w.lngLat },
        weight: 5,
        ...carryTrips('place-work'),
      })
    }
    if (s.schoolPlace) {
      const sc = s.schoolPlace
      list.push({
        id: 'place-school',
        name: sc.label,
        addressSubtitle: sc.address?.trim() || undefined,
        category: 'school',
        lngLat: { ...sc.lngLat },
        weight: 4,
        ...carryTrips('place-school'),
      })
    }

    if (!home || !token) {
      if (mySeq === s.rebuildSeq) {
        s.anchors = list
        s.discoveringPois = false
      }
      return
    }

    s.discoveringPois = true
    s.poiDiscoverError = null

    try {
      const pois = await discoverNearbyPois(home, base, token)
      if (mySeq !== s.rebuildSeq) return

      pois.groceries.forEach((g, i) => {
        const id = `poi-grocery-${i}`
        list.push({
          id,
          name: g.poiName ?? g.place_name,
          addressSubtitle: g.poiAddress,
          category: 'grocery',
          lngLat: lngLatFromCenter(g.center),
          weight: 4,
          ...carryTrips(id),
        })
      })
      if (pois.gas) {
        const g = pois.gas
        list.push({
          id: 'poi-gas',
          name: g.poiName ?? g.place_name,
          addressSubtitle: g.poiAddress,
          category: 'gas',
          lngLat: lngLatFromCenter(g.center),
          weight: 2,
          ...carryTrips('poi-gas'),
        })
      }
      if (pois.gym) {
        const g = pois.gym
        list.push({
          id: 'poi-gym',
          name: g.poiName ?? g.place_name,
          addressSubtitle: g.poiAddress,
          category: 'gym',
          lngLat: lngLatFromCenter(g.center),
          weight: 3,
          ...carryTrips('poi-gym'),
        })
      }
      if (pois.pharmacy) {
        const p = pois.pharmacy
        list.push({
          id: 'poi-pharmacy',
          name: p.poiName ?? p.place_name,
          addressSubtitle: p.poiAddress,
          category: 'pharmacy',
          lngLat: lngLatFromCenter(p.center),
          weight: 3,
          ...carryTrips('poi-pharmacy'),
        })
      }
      if (pois.social) {
        const soc = pois.social
        list.push({
          id: 'poi-social',
          name: soc.poiName ?? soc.place_name,
          addressSubtitle: soc.poiAddress,
          category: 'social',
          lngLat: lngLatFromCenter(soc.center),
          weight: 2,
          ...carryTrips('poi-social'),
        })
      }
    } catch (e) {
      if (mySeq === s.rebuildSeq) {
        s.poiDiscoverError = e instanceof Error ? e.message : 'Could not load nearby places'
      }
    } finally {
      if (mySeq === s.rebuildSeq) {
        s.anchors = list
        s.discoveringPois = false
      }
    }
  }

  function scheduleRebuildAnchors() {
    const s = active.value
    if (!s) return
    if (s.debounceTimer) clearTimeout(s.debounceTimer)
    const sid = s.id
    s.debounceTimer = setTimeout(() => {
      const cur = getScenario(sid)
      if (cur) cur.debounceTimer = null
      void rebuildAnchorsForScenario(sid)
    }, 650)
  }

  async function runHomeReverseGeocode(scenarioId: string, lngLat: LngLat) {
    const s = getScenario(scenarioId)
    if (!s) return
    const id = ++s.homeGeocodeSeq
    const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'
    const token = config.public.mapboxAccessToken as string | undefined
    if (!token) return
    try {
      const line = await reverseGeocode(lngLat, base, token)
      if (id !== s.homeGeocodeSeq) return
      const h = s.candidateHome
      if (!h || h.lng !== lngLat.lng || h.lat !== lngLat.lat) return
      s.candidateHomeAddress = line
    } catch {
      /* keep coordinates-only fallback */
    }
  }

  async function runWorkReverseGeocode(scenarioId: string, lngLat: LngLat) {
    const s = getScenario(scenarioId)
    if (!s) return
    const id = ++s.workGeocodeSeq
    const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'
    const token = config.public.mapboxAccessToken as string | undefined
    if (!token) return
    try {
      const line = await reverseGeocode(lngLat, base, token)
      if (id !== s.workGeocodeSeq) return
      const p = s.workPlace
      if (!p || p.lngLat.lng !== lngLat.lng || p.lngLat.lat !== lngLat.lat) return
      s.workPlace = { ...p, address: line ?? undefined }
      void rebuildAnchorsForScenario(scenarioId)
    } catch {
      /* ignore */
    }
  }

  async function runSchoolReverseGeocode(scenarioId: string, lngLat: LngLat) {
    const s = getScenario(scenarioId)
    if (!s) return
    const id = ++s.schoolGeocodeSeq
    const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'
    const token = config.public.mapboxAccessToken as string | undefined
    if (!token) return
    try {
      const line = await reverseGeocode(lngLat, base, token)
      if (id !== s.schoolGeocodeSeq) return
      const p = s.schoolPlace
      if (!p || p.lngLat.lng !== lngLat.lng || p.lngLat.lat !== lngLat.lat) return
      s.schoolPlace = { ...p, address: line ?? undefined }
      void rebuildAnchorsForScenario(scenarioId)
    } catch {
      /* ignore */
    }
  }

  function setWorkPlace(place: NamedPlace | null) {
    const s = active.value
    if (!s) return
    s.workPlace = place
    s.scoreResult = null
    void rebuildAnchorsForScenario(s.id)
    if (place && !place.address?.trim()) void runWorkReverseGeocode(s.id, place.lngLat)
  }

  function setSchoolPlace(place: NamedPlace | null) {
    const s = active.value
    if (!s) return
    s.schoolPlace = place
    s.scoreResult = null
    void rebuildAnchorsForScenario(s.id)
    if (place && !place.address?.trim()) void runSchoolReverseGeocode(s.id, place.lngLat)
  }

  function setTravelMode(mode: TravelMode) {
    const s = active.value
    if (s) s.travelMode = mode
  }

  /**
   * @param fromSearch When true, `label` is treated as the formatted address (e.g. Mapbox `place_name`). When false/omitted, address is resolved via reverse geocode (map drop).
   */
  function setCandidateHome(lngLat: LngLat, label?: string | null, fromSearch?: boolean) {
    const s = active.value
    if (!s) return
    s.homeGeocodeSeq += 1
    s.candidateHome = { ...lngLat }
    s.candidateHomeLabel = label?.trim() || null
    if (fromSearch) {
      s.candidateHomeAddress = label?.trim() || null
    } else {
      s.candidateHomeAddress = null
      void runHomeReverseGeocode(s.id, lngLat)
    }
    s.scoreResult = null
    s.calculateError = null
    scheduleRebuildAnchors()
  }

  function clearCandidateHome() {
    const s = active.value
    if (!s) return
    s.homeGeocodeSeq += 1
    s.candidateHome = null
    s.candidateHomeLabel = null
    s.candidateHomeAddress = null
    s.scoreResult = null
    void rebuildAnchorsForScenario(s.id)
  }

  async function refreshNearbyPlaces() {
    const s = active.value
    if (s) await rebuildAnchorsForScenario(s.id)
  }

  async function calculateScore() {
    const s = active.value
    if (!s) return

    const scenarioId = s.id
    const home = s.candidateHome
    const token = config.public.mapboxAccessToken as string
    const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'

    const target = () => getScenario(scenarioId)

    const t0 = target()
    if (!t0) return
    t0.calculateError = null
    t0.scoreResult = null

    if (!home) {
      t0.calculateError = 'Choose a candidate home on the map or by address first.'
      return
    }
    if (t0.anchors.length === 0) {
      t0.calculateError = 'No places to score yet. Add work or school, or wait for nearby places to load.'
      return
    }
    if (!token) {
      t0.calculateError =
        'Add your Mapbox token to .env as NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN, restart the dev server, then try again.'
      return
    }

    t0.calculating = true
    try {
      const googleKey = String(config.public.googleMapsApiKey ?? '').trim()

      const snapAnchors = [...t0.anchors]
      const snapTravelMode = t0.travelMode

      const results: RouteCalcResult[] = await Promise.all(
        snapAnchors.map(async (a): Promise<RouteCalcResult> => {
          try {
            const detail = await getRouteDetail(home, a.lngLat, snapTravelMode, base, token)
            let chosenSeconds = detail.durationSeconds
            let overlayCoords = detail.geometry.coordinates
            let transitSec: number | null = null
            let commuteMode: 'walk' | 'transit' = 'walk'
            let commuteNote = ''

            if (snapTravelMode === 'transit') {
              if (googleKey) {
                try {
                  const tr = await $fetch<{
                    ok: boolean
                    transitSeconds?: number
                    polyline?: string
                    error?: string
                  }>('/api/commute-transit', {
                    method: 'POST',
                    body: {
                      origin: { lat: home.lat, lng: home.lng },
                      destination: { lat: a.lngLat.lat, lng: a.lngLat.lng },
                    },
                  })
                  if (tr.ok && tr.transitSeconds != null) {
                    transitSec = tr.transitSeconds
                    const picked = chooseWalkOrTransit(detail.durationSeconds, transitSec)
                    chosenSeconds = picked.seconds
                    commuteMode = picked.choice
                    commuteNote = picked.reason
                    if (picked.choice === 'transit' && tr.polyline) {
                      const decoded = decodeGooglePolyline(tr.polyline)
                      if (decoded.length >= 2) overlayCoords = decoded
                    }
                  } else {
                    commuteNote = 'No public transit itinerary matched this trip — walking time only.'
                  }
                } catch {
                  commuteNote = 'Couldn’t load transit times — walking time only.'
                }
              } else {
                commuteNote = 'Transit comparison isn’t available — walking time only.'
              }
            }

            return {
              id: a.id,
              minutes: chosenSeconds / 60,
              detail,
              overlayCoords,
              chosenSeconds,
              transitSec,
              commuteMode: snapTravelMode === 'transit' ? commuteMode : undefined,
              commuteNote: snapTravelMode === 'transit' ? commuteNote : undefined,
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Route failed'
            return {
              id: a.id,
              minutes: null,
              err: msg,
            }
          }
        }),
      )

      const t1 = target()
      if (!t1) return

      const map = new Map<string, number | null>()
      const errors = new Map<string, string>()
      const routeOverlays: RouteOverlay[] = []
      const trafficSummaries: AnchorTrafficSummary[] = []

      for (const r of results) {
        map.set(r.id, r.minutes)
        if (r.err) errors.set(r.id, r.err)
        if (r.detail) {
          const anchorMeta = snapAnchors.find((x) => x.id === r.id)
          routeOverlays.push({
            anchorId: r.id,
            category: anchorMeta?.category ?? 'custom',
            coordinates: r.overlayCoords ?? r.detail.geometry.coordinates,
          })
          const typical = r.detail.durationTypicalSeconds
          const summary: AnchorTrafficSummary = {
            anchorId: r.id,
            distanceKm: r.detail.distanceMeters / 1000,
            durationSeconds: r.chosenSeconds ?? r.detail.durationSeconds,
            typicalDurationSeconds: typical,
            delayVsTypicalSeconds:
              typical != null ? (r.chosenSeconds ?? r.detail.durationSeconds) - typical : null,
            congestedDurationFraction: r.detail.congestedDurationFraction,
            walkDetourFactor: r.detail.walkDetourFactor,
          }
          if (snapTravelMode === 'transit') {
            summary.walkCommuteSeconds = r.detail.durationSeconds
            summary.transitCommuteSeconds = r.transitSec ?? null
            summary.commuteModeUsed = r.commuteMode ?? 'walk'
            summary.commuteChoiceNote = r.commuteNote ?? null
          }
          trafficSummaries.push(summary)
        }
      }

      const scored = scoreFromRoutes(snapAnchors, map)
      const rows = scored.rows.map((row) => {
        const err = errors.get(row.anchorId)
        if (err) return { ...row, error: err, durationMinutes: null, weightedImpact: null }
        return row
      })

      const anyLegUsedTransit = trafficSummaries.some((tr) => tr.commuteModeUsed === 'transit')

      const nextResult: ScoreResult = {
        lifeScore: scored.lifeScore,
        totalBurden: scored.totalBurden,
        yearlyTravelMinutes: estimateYearlyTravelMinutes(snapAnchors, rows),
        rows,
        insight: insightForTravelMode(
          scored.insight,
          snapTravelMode,
          scored.topBurdenAnchorId,
          snapAnchors,
          { anyLegUsedTransit, transitComparisonEnabled: Boolean(googleKey) },
        ),
        topBurdenAnchorId: scored.topBurdenAnchorId,
        routeOverlays,
        trafficSummaries,
      }

      t1.scoreResult = nextResult
    } finally {
      const t2 = target()
      if (t2) t2.calculating = false
    }
  }

  /** After trip-frequency edits: recompute life score, row impacts, and yearly time from stored route minutes. */
  function refreshScoreAfterTripFrequencyChange() {
    const s = active.value
    if (!s?.scoreResult) return
    const sr = s.scoreResult
    const rescored = rescoreKeepingRouteErrors(s.anchors, sr.rows)
    const anyLegUsedTransit = sr.trafficSummaries.some((tr) => tr.commuteModeUsed === 'transit')
    const googleKey = String(config.public.googleMapsApiKey ?? '').trim()
    s.scoreResult = {
      ...sr,
      lifeScore: rescored.lifeScore,
      totalBurden: rescored.totalBurden,
      rows: rescored.rows,
      insight: insightForTravelMode(
        rescored.insight,
        s.travelMode,
        rescored.topBurdenAnchorId,
        s.anchors,
        { anyLegUsedTransit, transitComparisonEnabled: Boolean(googleKey) },
      ),
      topBurdenAnchorId: rescored.topBurdenAnchorId,
      yearlyTravelMinutes: estimateYearlyTravelMinutes(s.anchors, rescored.rows),
    }
  }

  /** `null` clears the override (category default). */
  function setAnchorRoundTripsPerWeek(anchorId: string, roundTripsPerWeek: number | null) {
    const s = active.value
    if (!s) return
    const i = s.anchors.findIndex((a) => a.id === anchorId)
    if (i === -1) return
    const cur = s.anchors[i]!
    const next: Anchor = { ...cur }
    if (roundTripsPerWeek == null || Number.isNaN(roundTripsPerWeek)) {
      delete next.roundTripsPerWeek
    } else {
      const clamped = Math.min(42, Math.max(0, roundTripsPerWeek))
      next.roundTripsPerWeek = clamped
    }
    const copy = [...s.anchors]
    copy[i] = next
    s.anchors = copy
    refreshScoreAfterTripFrequencyChange()
  }

  function clearScenarioTimers(s: ScenarioInternal) {
    s.rebuildSeq += 1
    if (s.debounceTimer) {
      clearTimeout(s.debounceTimer)
      s.debounceTimer = null
    }
  }

  function setActiveScenario(id: string) {
    if (getScenario(id)) activeScenarioId.value = id
  }

  function addScenario(): boolean {
    if (scenarios.value.length >= MAX_SCENARIOS) return false
    const next = createEmptyScenario(scenarios.value.length + 1)
    scenarios.value = [...scenarios.value, next]
    activeScenarioId.value = next.id
    return true
  }

  function removeScenario(id: string): boolean {
    if (scenarios.value.length <= 1) return false
    const idx = findScenarioIndex(id)
    if (idx === -1) return false
    const removed = scenarios.value[idx]!
    clearScenarioTimers(removed)
    const nextList = scenarios.value.filter((x) => x.id !== id)
    scenarios.value = nextList
    if (activeScenarioId.value === id) {
      activeScenarioId.value = nextList[0]!.id
    }
    return true
  }

  function setScenarioLabel(id: string, label: string) {
    const s = getScenario(id)
    if (s) s.label = label.trim() || s.label
  }

  function resetAll() {
    for (const s of scenarios.value) {
      clearScenarioTimers(s)
      s.homeGeocodeSeq += 1
      s.workGeocodeSeq += 1
      s.schoolGeocodeSeq += 1
    }
    const fresh = createEmptyScenario(1)
    scenarios.value = [fresh]
    activeScenarioId.value = fresh.id
  }

  function setShowTrafficLayer(on: boolean) {
    const s = active.value
    if (s) s.showTrafficLayer = on
  }

  function setShowTransitLayer(on: boolean) {
    const s = active.value
    if (s) s.showTransitLayer = on
  }

  const scoredScenarioCount = computed(() => scenarios.value.filter((s) => s.scoreResult != null).length)

  return {
    maxScenarios: MAX_SCENARIOS,
    scenarios,
    activeScenarioId,
    scoredScenarioCount,
    setActiveScenario,
    addScenario,
    removeScenario,
    setScenarioLabel,
    anchors,
    candidateHome,
    candidateHomeLabel,
    candidateHomeAddress,
    workPlace,
    schoolPlace,
    travelMode,
    scoreResult,
    calculating,
    calculateError,
    discoveringPois,
    poiDiscoverError,
    showTrafficLayer,
    showTransitLayer,
    setShowTrafficLayer,
    setShowTransitLayer,
    setTravelMode,
    setCandidateHome,
    clearCandidateHome,
    setWorkPlace,
    setSchoolPlace,
    refreshNearbyPlaces,
    calculateScore,
    setAnchorRoundTripsPerWeek,
    resetAll,
  }
}
