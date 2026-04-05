import type { Anchor, AnchorCategory, TravelMode } from '~/types'

export function categoryDisplayName(cat: AnchorCategory): string {
  const map: Record<AnchorCategory, string> = {
    work: 'Work',
    school: 'School',
    gym: 'Gym',
    grocery: 'Grocery',
    gas: 'Gas station',
    pharmacy: 'Pharmacy',
    social: 'Social',
    custom: 'Place',
  }
  return map[cat]
}

/** Why this type of place is part of the Life Score. */
export function roleInScore(anchor: Anchor): string {
  switch (anchor.category) {
    case 'work':
      return 'Your commute to work usually matters a lot — it’s often the trip you repeat most in a week.'
    case 'school':
      return 'School or campus runs (drop-offs, classes) add regular trips from home.'
    case 'grocery':
      return 'We include several of the closest grocery-type stores nearby so regular food shopping moves the score more than a rare errand would.'
    case 'gas':
      return 'We picked a nearby gas station to reflect how easy it is to refuel when you drive.'
    case 'pharmacy':
      return 'We picked a nearby pharmacy for prescriptions and drugstore errands.'
    case 'gym':
      return 'We picked a nearby gym or fitness spot to represent how easy it is to get workouts in.'
    case 'social':
      return 'We picked a nearby restaurant, pub, or café to stand in for dining out and social time.'
    case 'custom':
      return 'This custom place is included with the importance you assigned.'
    default:
      return 'This place is included in how we calculate your score.'
  }
}

/** Plain-language note from travel time (one-way, selected mode). */
export function convenienceFromMinutes(minutes: number): string {
  if (minutes <= 5) return 'Very close — this is easy to repeat often.'
  if (minutes <= 10) return 'Short hop — generally convenient for regular visits.'
  if (minutes <= 18) return 'Moderate distance — fine occasionally, adds up if you go often.'
  if (minutes <= 30) return 'A longer leg — each trip takes a noticeable slice of the day.'
  return 'Quite far — this commute will strongly pull your convenience score down.'
}

function formatHoursDaysParts(yearlyTravelMinutes: number): { hStr: string; dStr: string } | null {
  if (yearlyTravelMinutes <= 0) return null
  const hours = yearlyTravelMinutes / 60
  const days = hours / 24
  const hStr = hours >= 100 ? String(Math.round(hours)) : (Math.round(hours * 10) / 10).toFixed(1)
  const dStr = days >= 10 ? String(Math.round(days)) : (Math.round(days * 10) / 10).toFixed(1)
  return { hStr, dStr }
}

/** Short line for tight UI (badges, hero chips). */
export function formatYearlyTravelCompact(yearlyTravelMinutes: number): string {
  const p = formatHoursDaysParts(yearlyTravelMinutes)
  if (!p) return ''
  return `~${p.hStr} h/year (~${p.dStr} days of travel)`
}

/** Human-readable yearly time on the road (or walk/cycle) from estimated annual trips. */
export function formatYearlyTravelSummary(yearlyTravelMinutes: number): string {
  const p = formatHoursDaysParts(yearlyTravelMinutes)
  if (!p) return ''
  return `About ${p.hStr} hours per year on these trips (~${p.dStr} full 24-hour days of travel).`
}

export function yearlyTravelAssumptionNote(): string {
  return 'Defaults follow typical visit patterns by place type. On the Life score tab you can set round trips per week per stop. Groceries use your shortest grocery leg; trip rates from every grocery row are averaged (blank = default for groceries).'
}

export function weightedNote(weightedImpact: number, totalBurden: number): string {
  if (totalBurden <= 0) return ''
  const pct = Math.round((weightedImpact / totalBurden) * 100)
  if (pct >= 35)
    return `This place accounts for about ${pct}% of the overall hassle we measured — it’s one of the biggest levers on your score.`
  if (pct >= 20)
    return `Roughly ${pct}% of that overall picture — it matters a lot for how convenient this home feels.`
  if (pct >= 10) return `About ${pct}% of the mix — one of several meaningful trips.`
  return `A smaller piece of the picture (${pct}% of the total we added up).`
}

export function insightForTravelMode(
  scoredInsight: string,
  mode: TravelMode,
  topBurdenAnchorId: string | null,
  anchors: Anchor[],
  options?: { anyLegUsedTransit: boolean; transitComparisonEnabled: boolean },
): string {
  if (mode !== 'transit') return scoredInsight
  const topName = topBurdenAnchorId ? anchors.find((a) => a.id === topBurdenAnchorId)?.name ?? null : null
  const head = topName
    ? `${topName} is where the most commute time stacks up for this home.`
    : scoredInsight

  if (options?.anyLegUsedTransit) {
    return `${head} We mixed walking and public transit times where transit was clearly faster; other legs stayed on walking.`
  }
  if (!options?.transitComparisonEnabled) {
    return `${head} We couldn’t compare public transit with walking for these trips, so this score uses walking time for every leg.`
  }
  return `${head} Every leg used walking time — either the trip was short enough to walk, or transit wasn’t clearly faster.`
}
