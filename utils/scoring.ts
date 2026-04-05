import type { Anchor, AnchorCategory, AnchorRouteResult } from '~/types'

/** Tune overall score sensitivity: higher = gentler score drop per unit burden. */
export const BURDEN_NORMALIZATION_DIVISOR = 5

/**
 * Baseline round trips per year by place type (defaults when the user leaves “rounds / week” blank).
 * Used for yearly time estimates and to scale each anchor’s score impact vs that baseline when frequency is customized.
 * Grocery yearly time uses the shortest leg and averages weekly rates across grocery rows.
 */
export const ROUND_TRIPS_PER_YEAR: Record<AnchorCategory, number> = {
  work: 260,
  school: 180,
  gym: 156,
  grocery: 104,
  gas: 24,
  pharmacy: 24,
  social: 52,
  custom: 104,
}

const WEEKS_PER_YEAR = 52

export function defaultRoundTripsPerWeek(category: AnchorCategory): number {
  return ROUND_TRIPS_PER_YEAR[category] / WEEKS_PER_YEAR
}

function yearlyRoundTripsForAnchor(a: Anchor): number {
  const w = a.roundTripsPerWeek
  if (w != null && Number.isFinite(w) && w >= 0) {
    return w * WEEKS_PER_YEAR
  }
  return ROUND_TRIPS_PER_YEAR[a.category]
}

/** Scales burden vs category default trip rate (1.0 when using defaults). */
export function tripFrequencyMultiplier(a: Anchor): number {
  const baseline = ROUND_TRIPS_PER_YEAR[a.category]
  if (baseline <= 0) return 1
  return yearlyRoundTripsForAnchor(a) / baseline
}

export function estimateYearlyTravelMinutes(anchors: Anchor[], rows: AnchorRouteResult[]): number {
  const rowByAnchor = new Map(rows.map((r) => [r.anchorId, r]))
  let sum = 0

  let groceryMinOneWay: number | null = null
  const groceryWeeks: number[] = []
  const defaultGroceryWeeks = defaultRoundTripsPerWeek('grocery')
  for (const a of anchors) {
    if (a.category !== 'grocery') continue
    const row = rowByAnchor.get(a.id)
    if (row?.error || row?.durationMinutes == null) continue
    const m = row.durationMinutes
    if (groceryMinOneWay == null || m < groceryMinOneWay) groceryMinOneWay = m
    const w = a.roundTripsPerWeek
    groceryWeeks.push(
      w != null && Number.isFinite(w) && w >= 0 ? w : defaultGroceryWeeks,
    )
  }
  if (groceryMinOneWay != null && groceryWeeks.length > 0) {
    const avgW = groceryWeeks.reduce((s, v) => s + v, 0) / groceryWeeks.length
    sum += groceryMinOneWay * 2 * avgW * WEEKS_PER_YEAR
  }

  for (const a of anchors) {
    if (a.category === 'grocery') continue
    const row = rowByAnchor.get(a.id)
    if (!row || row.error || row.durationMinutes == null) continue
    sum += row.durationMinutes * 2 * yearlyRoundTripsForAnchor(a)
  }

  return sum
}

export const MIN_SCORE = 0
export const MAX_SCORE = 100

export function computeWeightedImpact(durationMinutes: number, weight: number): number {
  return durationMinutes * weight
}

export function computeWeightedImpactForAnchor(durationMinutes: number, a: Anchor): number {
  return durationMinutes * a.weight * tripFrequencyMultiplier(a)
}

export function computeLifeScore(totalBurden: number): number {
  return Math.max(MIN_SCORE, Math.round(MAX_SCORE - totalBurden / BURDEN_NORMALIZATION_DIVISOR))
}

export function buildInsight(topName: string | null): string {
  if (!topName) {
    return 'Add anchors and calculate to see which place affects your score the most.'
  }
  return `${topName} is contributing most to your daily commute burden.`
}

export function scoreFromRoutes(
  anchors: Anchor[],
  minutesByAnchorId: Map<string, number | null>,
): { totalBurden: number; lifeScore: number; rows: AnchorRouteResult[]; insight: string; topBurdenAnchorId: string | null } {
  const rows: AnchorRouteResult[] = []
  let totalBurden = 0
  let topId: string | null = null
  let topImpact = -1

  for (const a of anchors) {
    const mins = minutesByAnchorId.get(a.id)
    if (mins == null || Number.isNaN(mins)) {
      rows.push({
        anchorId: a.id,
        durationMinutes: null,
        weightedImpact: null,
        error: 'No route',
      })
      continue
    }
    const wi = computeWeightedImpactForAnchor(mins, a)
    totalBurden += wi
    rows.push({
      anchorId: a.id,
      durationMinutes: mins,
      weightedImpact: wi,
    })
    if (wi > topImpact) {
      topImpact = wi
      topId = a.id
    }
  }

  const lifeScore = computeLifeScore(totalBurden)
  const topName = topId ? anchors.find((x) => x.id === topId)?.name ?? null : null
  const insight = buildInsight(topName)

  return { totalBurden, lifeScore, rows, insight, topBurdenAnchorId: topId }
}

/**
 * Recompute burden, per-row weighted impact, and life score from stored route minutes (e.g. after trip frequency edits).
 * Preserves API/route error messages from the previous rows.
 */
export function rescoreKeepingRouteErrors(
  anchors: Anchor[],
  previousRows: AnchorRouteResult[],
): { totalBurden: number; lifeScore: number; rows: AnchorRouteResult[]; insight: string; topBurdenAnchorId: string | null } {
  const prevById = new Map(previousRows.map((r) => [r.anchorId, r]))
  const minutesByAnchorId = new Map<string, number | null>()
  for (const a of anchors) {
    const prev = prevById.get(a.id)
    if (!prev || prev.error || prev.durationMinutes == null) {
      minutesByAnchorId.set(a.id, null)
    } else {
      minutesByAnchorId.set(a.id, prev.durationMinutes)
    }
  }

  const scored = scoreFromRoutes(anchors, minutesByAnchorId)
  const rows = scored.rows.map((row) => {
    const prev = prevById.get(row.anchorId)
    if (prev?.error) {
      return {
        anchorId: row.anchorId,
        durationMinutes: null,
        weightedImpact: null,
        error: prev.error,
      }
    }
    return row
  })

  return {
    totalBurden: scored.totalBurden,
    lifeScore: scored.lifeScore,
    rows,
    insight: scored.insight,
    topBurdenAnchorId: scored.topBurdenAnchorId,
  }
}
