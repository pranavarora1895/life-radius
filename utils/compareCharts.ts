import type { AnchorCategory, GroceryCompareLeg, PlanCompareSnapshot } from '~/types'
import { categoryDisplayName } from '~/utils/scoreExplain'

/** Hex fills for donut / radar (matches dashboard category colors). */
export const CATEGORY_HEX: Record<AnchorCategory, string> = {
  work: '#8b5cf6',
  school: '#38bdf8',
  grocery: '#34d399',
  gas: '#fbbf24',
  pharmacy: '#fb7185',
  gym: '#f97316',
  social: '#e879f9',
  custom: '#94a3b8',
}

export type BurdenSlice = {
  category: AnchorCategory
  weight: number
  pct: number
  color: string
  label: string
}

/** Slices for donut: share of total burden each place type contributes. */
export function burdenSlicesForSnapshot(sn: PlanCompareSnapshot): BurdenSlice[] {
  const t = sn.totalBurden
  if (t <= 0) return []
  const rows = sn.byCategory.filter((r) => r.weightedSum > 0 && r.legCount > 0)
  return rows.map((r) => ({
    category: r.category,
    weight: r.weightedSum,
    pct: (r.weightedSum / t) * 100,
    color: CATEGORY_HEX[r.category] ?? CATEGORY_HEX.custom,
    label:
      r.category === 'grocery' && sn.groceryLegs.length > 1
        ? `Groceries (${sn.groceryLegs.length} stops)`
        : categoryDisplayName(r.category),
  }))
}

/** Distinct greens for up to four grocery legs in a sunburst ring. */
export const GROCERY_SUNBURST_SHADES = ['#065f46', '#047857', '#059669', '#10b981'] as const

export type GrocerySunburstOuter = { d: string; color: string; leg: GroceryCompareLeg }

/** Inner ring: combined grocery bucket (100% of grocery burden). */
export function grocerySunburstInnerPath(
  cx: number,
  cy: number,
  rInner: number,
  rMid: number,
): string {
  return donutSlicePath(cx, cy, rInner, rMid, 0, 2 * Math.PI - 1e-4)
}

/** Outer ring: each grocery stop’s share of the grocery total. */
export function grocerySunburstOuterPaths(
  legs: GroceryCompareLeg[],
  cx: number,
  cy: number,
  rMid: number,
  rOuter: number,
): GrocerySunburstOuter[] {
  const total = legs.reduce((s, l) => s + l.weightedSum, 0)
  if (total <= 0 || !legs.length) return []
  const full = 2 * Math.PI
  let a = 0
  const out: GrocerySunburstOuter[] = []
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!
    const da = (leg.weightedSum / total) * full
    if (da < 1e-6) continue
    out.push({
      d: donutSlicePath(cx, cy, rMid, rOuter, a, a + da),
      color: GROCERY_SUNBURST_SHADES[i % GROCERY_SUNBURST_SHADES.length]!,
      leg,
    })
    a += da
  }
  return out
}

/** Polar dot: angle 0 = top, clockwise (SVG y-down). */
export function polarDot(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  }
}

export function donutSlicePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  angleStart: number,
  angleEnd: number,
): string {
  const p0o = polarDot(cx, cy, rOuter, angleStart)
  const p1o = polarDot(cx, cy, rOuter, angleEnd)
  const p1i = polarDot(cx, cy, rInner, angleEnd)
  const p0i = polarDot(cx, cy, rInner, angleStart)
  const da = angleEnd - angleStart
  const largeArc = da > Math.PI ? 1 : 0
  return `M ${p0o.x} ${p0o.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x} ${p1o.y} L ${p1i.x} ${p1i.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x} ${p0i.y} Z`
}

export type DonutPath = { d: string; color: string; category: AnchorCategory }

export function buildDonutPaths(
  slices: BurdenSlice[],
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
): DonutPath[] {
  if (!slices.length) return []
  const totalW = slices.reduce((a, s) => a + s.weight, 0)
  if (totalW <= 0) return []
  const full = 2 * Math.PI
  let a = 0
  const out: DonutPath[] = []
  for (const sl of slices) {
    const da = (sl.weight / totalW) * full
    if (da < 0.0001) continue
    out.push({
      d: donutSlicePath(cx, cy, rInner, rOuter, a, a + da),
      color: sl.color,
      category: sl.category,
    })
    a += da
  }
  return out
}

/** Semicircle arc length (radius r, half circle). */
export function semicircleArcLength(r: number) {
  return Math.PI * r
}
