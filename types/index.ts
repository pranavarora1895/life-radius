export type AnchorCategory =
  | 'work'
  | 'school'
  | 'gym'
  | 'grocery'
  | 'gas'
  | 'pharmacy'
  | 'social'
  | 'custom'

export type TravelMode = 'driving' | 'walking' | 'cycling' | 'transit'

export interface LngLat {
  lng: number
  lat: number
}

export interface NamedPlace {
  lngLat: LngLat
  label: string
  /** Formatted address from search or reverse geocode; shown in read-only views. */
  address?: string
}

export interface Anchor {
  id: string
  name: string
  /** Street / formatted address line under the name (auto-picked POIs from Search Box). */
  addressSubtitle?: string
  category: AnchorCategory
  lngLat: LngLat
  weight: number
  /**
   * Optional round trips per week (out-and-back). Omitted = built-in default for this place type.
   * Scales both yearly time and how much this leg affects the Life Score vs that default.
   */
  roundTripsPerWeek?: number
}

export interface AnchorRouteResult {
  anchorId: string
  durationMinutes: number | null
  weightedImpact: number | null
  error?: string
}

/** One scored leg drawn on the map (home → anchor). */
export interface RouteOverlay {
  anchorId: string
  /** Used for route line + legend (matches anchor category). */
  category: AnchorCategory
  coordinates: [number, number][]
}

/** Per-anchor traffic / route metadata (driving uses live traffic profile when available). */
export interface AnchorTrafficSummary {
  anchorId: string
  distanceKm: number | null
  /** Route duration used for the score (seconds). */
  durationSeconds: number
  /** Typical duration without current traffic (`driving-traffic` only). */
  typicalDurationSeconds: number | null
  /** Positive when current trip is slower than typical. */
  delayVsTypicalSeconds: number | null
  /** Share of leg time in moderate, heavy, or severe congestion (`driving-traffic` only). */
  congestedDurationFraction: number | null
  /**
   * Transit mode only: walking path length ÷ straight-line distance (≥ 1). UI explains this as “% longer than a straight line.”
   */
  walkDetourFactor: number | null
  /** Transit mode: walking duration from the walking route (seconds, one way). */
  walkCommuteSeconds?: number | null
  /** Transit mode: public-transit duration when available (seconds, one way). */
  transitCommuteSeconds?: number | null
  /** Transit mode: whether the score used walking or public-transit duration for this leg. */
  commuteModeUsed?: 'walk' | 'transit' | null
  /** Transit mode: short explanation for the commute row UI. */
  commuteChoiceNote?: string | null
}

export interface ScoreResult {
  lifeScore: number
  totalBurden: number
  /** Sum of round-trip minutes × assumed annual trips per place type (see scoring). */
  yearlyTravelMinutes: number
  rows: AnchorRouteResult[]
  insight: string
  topBurdenAnchorId: string | null
  routeOverlays: RouteOverlay[]
  trafficSummaries: AnchorTrafficSummary[]
}

/** One row for score dashboard charts (home → anchor). */
export interface ScoreDashboardLeg {
  anchorId: string
  name: string
  category: AnchorCategory
  minutes: number | null
  weighted: number | null
  error?: string
  traffic?: AnchorTrafficSummary | null
}

export interface GeocodeFeature {
  id: string
  place_name: string
  center: [number, number]
  /** Search Box POI name (`properties.name`), when distinct from a single-line `place_name`. */
  poiName?: string
  /** Address line suitable for display under `poiName` (derived from Search Box address fields). */
  poiAddress?: string
}

/** One plan-and-score workspace (up to three per session). */
export interface LifePlan {
  id: string
  label: string
  candidateHome: LngLat | null
  candidateHomeLabel: string | null
  candidateHomeAddress: string | null
  workPlace: NamedPlace | null
  schoolPlace: NamedPlace | null
  travelMode: TravelMode
  anchors: Anchor[]
  scoreResult: ScoreResult | null
  calculating: boolean
  calculateError: string | null
  discoveringPois: boolean
  poiDiscoverError: string | null
  showTrafficLayer: boolean
  showTransitLayer: boolean
}

/** Aggregated weighted burden per category for cross-plan charts. */
export interface PlanCompareCategoryRow {
  category: AnchorCategory
  /** Sum of weighted impact for legs in this category (0 if none / errors). */
  weightedSum: number
  /** Average one-way trip minutes for legs with a valid route in this category. */
  avgOneWayMinutes: number | null
  legCount: number
}

/** One scored grocery anchor (up to four) for sunburst / honest breakdown in Compare. */
export interface GroceryCompareLeg {
  anchorId: string
  name: string
  weightedSum: number
  /** Share among grocery legs only (sums to 100 when all have weight). */
  pctOfGrocery: number
  /** Share of entire plan total burden — comparable to other place types. */
  pctOfTotalBurden: number
}

/** Snapshot derived from one scored plan for the Compare view. */
export interface PlanCompareSnapshot {
  planId: string
  label: string
  lifeScore: number
  totalBurden: number
  yearlyTravelMinutes: number
  travelMode: TravelMode
  byCategory: PlanCompareCategoryRow[]
  /** Per-grocery-stop burden; empty if no groceries. Used for sunburst (multiple stops vs one lump). */
  groceryLegs: GroceryCompareLeg[]
}
