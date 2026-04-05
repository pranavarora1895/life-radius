import type {
  Anchor,
  AnchorCategory,
  GroceryCompareLeg,
  LifePlan,
  PlanCompareCategoryRow,
  PlanCompareSnapshot,
} from '~/types'

const CATEGORY_ORDER: AnchorCategory[] = [
  'work',
  'school',
  'grocery',
  'gas',
  'pharmacy',
  'gym',
  'social',
  'custom',
]

/**
 * Build a compare snapshot from one scored plan (aggregates legs by anchor category).
 */
export function buildPlanCompareSnapshot(
  planId: string,
  label: string,
  travelMode: LifePlan['travelMode'],
  anchors: Anchor[],
  scoreResult: NonNullable<LifePlan['scoreResult']>,
): PlanCompareSnapshot {
  const anchorById = new Map(anchors.map((a) => [a.id, a]))

  const buckets = new Map<
    AnchorCategory,
    { weighted: number; minutesSum: number; minutesCount: number; legCount: number }
  >()
  for (const c of CATEGORY_ORDER) {
    buckets.set(c, { weighted: 0, minutesSum: 0, minutesCount: 0, legCount: 0 })
  }

  for (const row of scoreResult.rows) {
    const a = anchorById.get(row.anchorId)
    if (!a) continue
    const b = buckets.get(a.category)
    if (!b) continue
    b.legCount += 1
    if (row.weightedImpact != null) b.weighted += row.weightedImpact
    if (row.durationMinutes != null && !row.error) {
      b.minutesSum += row.durationMinutes
      b.minutesCount += 1
    }
  }

  const byCategory: PlanCompareCategoryRow[] = CATEGORY_ORDER.map((category) => {
    const b = buckets.get(category)!
    return {
      category,
      weightedSum: Math.round(b.weighted * 1000) / 1000,
      avgOneWayMinutes: b.minutesCount > 0 ? Math.round((b.minutesSum / b.minutesCount) * 10) / 10 : null,
      legCount: b.legCount,
    }
  })

  const groceryRaw: { anchorId: string; name: string; weightedSum: number }[] = []
  for (const row of scoreResult.rows) {
    const a = anchorById.get(row.anchorId)
    if (!a || a.category !== 'grocery') continue
    const w = row.weightedImpact
    if (w == null || w <= 0) continue
    groceryRaw.push({ anchorId: a.id, name: a.name, weightedSum: Math.round(w * 1000) / 1000 })
  }
  groceryRaw.sort((x, y) => y.weightedSum - x.weightedSum)
  const gTotal = groceryRaw.reduce((s, x) => s + x.weightedSum, 0)
  const tb = scoreResult.totalBurden
  const groceryLegs: GroceryCompareLeg[] = groceryRaw.map((g) => ({
    ...g,
    pctOfGrocery: gTotal > 0 ? Math.round((g.weightedSum / gTotal) * 1000) / 10 : 0,
    pctOfTotalBurden: tb > 0 ? Math.round((g.weightedSum / tb) * 1000) / 10 : 0,
  }))

  return {
    planId,
    label,
    lifeScore: scoreResult.lifeScore,
    totalBurden: scoreResult.totalBurden,
    yearlyTravelMinutes: scoreResult.yearlyTravelMinutes,
    travelMode,
    byCategory,
    groceryLegs,
  }
}

/** Snapshots for every plan that has a score (for the Compare view). */
export function snapshotsFromPlans(plans: LifePlan[]): PlanCompareSnapshot[] {
  return plans
    .filter((s): s is LifePlan & { scoreResult: NonNullable<LifePlan['scoreResult']> } => s.scoreResult != null)
    .map((s) =>
      buildPlanCompareSnapshot(s.id, s.label, s.travelMode, s.anchors, s.scoreResult),
    )
}

/** Categories that have at least one leg in any snapshot (for chart rows). */
export function categoriesPresentInSnapshots(snapshots: PlanCompareSnapshot[]): AnchorCategory[] {
  const set = new Set<AnchorCategory>()
  for (const sn of snapshots) {
    for (const row of sn.byCategory) {
      if (row.legCount > 0) set.add(row.category)
    }
  }
  return CATEGORY_ORDER.filter((c) => set.has(c))
}
