<script setup lang="ts">
import type { AnchorCategory, ScoreDashboardLeg, TravelMode } from '~/types'
import { categoryIconName } from '~/utils/categoryIcons'
import { buildDonutPaths, CATEGORY_HEX, GROCERY_SUNBURST_SHADES, type BurdenSlice } from '~/utils/compareCharts'
import { formatYearlyTravelCompact } from '~/utils/scoreExplain'

const props = withDefaults(
  defineProps<{
    lifeScore: number
    totalBurden: number
    yearlyTravelMinutes: number
    insight: string
    legs: ScoreDashboardLeg[]
    travelMode: TravelMode
    /** Slim charts only (no hero / traffic cards) for sidebar layouts. */
    compact?: boolean
  }>(),
  { compact: false },
)

const uid = useId()

/** Ring geometry for score gauge (viewBox 0 0 100 100). */
const R = 40
const CIRC = 2 * Math.PI * R

const scoreDashOffset = computed(() => CIRC * (1 - Math.min(100, Math.max(0, props.lifeScore)) / 100))

const scoreLabel = computed(() => {
  const s = props.lifeScore
  if (s >= 75) return 'Strong convenience'
  if (s >= 55) return 'Solid overall'
  if (s >= 40) return 'Room to improve'
  return 'Heavy travel friction'
})

const yearlyTravelChip = computed(() => formatYearlyTravelCompact(props.yearlyTravelMinutes))

const maxMinutes = computed(() => {
  const m = Math.max(0, ...props.legs.map((l: ScoreDashboardLeg) => l.minutes ?? 0))
  return m > 0 ? m : 1
})

function sharePct(w: number | null): number {
  if (w == null || props.totalBurden <= 0) return 0
  return Math.round((w / props.totalBurden) * 100)
}

/** Legs that contribute weighted burden (same filter as donut / mix bar). */
const legsForDonut = computed(() =>
  props.legs.filter((l) => l.weighted != null && l.weighted > 0 && !l.error),
)

const legBurdenSlices = computed((): BurdenSlice[] => {
  const t = props.totalBurden
  if (t <= 0) return []
  const groceryCount = legsForDonut.value.filter((l) => l.category === 'grocery').length
  let groceryOrdinal = 0
  return legsForDonut.value.map((l) => {
    const isGrocery = l.category === 'grocery'
    const color = isGrocery
      ? groceryCount > 1
        ? GROCERY_SUNBURST_SHADES[groceryOrdinal++ % GROCERY_SUNBURST_SHADES.length]!
        : CATEGORY_HEX.grocery
      : CATEGORY_HEX[l.category] ?? CATEGORY_HEX.custom
    return {
      category: l.category,
      weight: l.weighted as number,
      pct: ((l.weighted as number) / t) * 100,
      color,
      label: l.name,
    }
  })
})

/** Match Compare tab donut geometry. */
const donutR = { inner: 38, outer: 62 }
const donutBox = 150

const donutPathsForLegs = computed(() =>
  buildDonutPaths(legBurdenSlices.value, donutBox / 2, donutBox / 2, donutR.inner, donutR.outer),
)

/** Legend swatch: matches donut slices (several groceries → distinct green wedges). */
function donutLegendColor(leg: ScoreDashboardLeg, indexInDonutList: number): string {
  if (leg.category !== 'grocery') return CATEGORY_HEX[leg.category] ?? CATEGORY_HEX.custom
  const list = legsForDonut.value
  const groceryCount = list.filter((x) => x.category === 'grocery').length
  if (groceryCount <= 1) return CATEGORY_HEX.grocery
  let g = 0
  for (let i = 0; i < indexInDonutList; i++) {
    if (list[i]?.category === 'grocery') g++
  }
  return GROCERY_SUNBURST_SHADES[g % GROCERY_SUNBURST_SHADES.length]!
}

function barPct(value: number | null, max: number): number {
  if (value == null || max <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

function categoryBarClass(cat: AnchorCategory): string {
  const map: Record<AnchorCategory, string> = {
    work: 'from-violet-500 to-violet-600',
    school: 'from-sky-500 to-blue-600',
    grocery: 'from-emerald-500 to-teal-600',
    gas: 'from-amber-500 to-orange-600',
    pharmacy: 'from-rose-500 to-pink-600',
    gym: 'from-orange-500 to-red-500',
    social: 'from-fuchsia-500 to-purple-600',
    custom: 'from-zinc-400 to-zinc-600',
  }
  return map[cat] ?? map.custom
}

function categorySegmentClass(cat: AnchorCategory): string {
  const map: Record<AnchorCategory, string> = {
    work: 'bg-violet-500',
    school: 'bg-sky-500',
    grocery: 'bg-emerald-500',
    gas: 'bg-amber-500',
    pharmacy: 'bg-rose-500',
    gym: 'bg-orange-500',
    social: 'bg-fuchsia-500',
    custom: 'bg-zinc-500',
  }
  return map[cat] ?? map.custom
}

/** Driving-only: roll up all legs for one summary + shared chart scale. */
const trafficAggregate = computed(() => {
  let totalDurationSec = 0
  let totalTypicalSec = 0
  let typicalCount = 0
  let weightedCongestion = 0
  let congWeight = 0
  let legsWithTraffic = 0

  for (const leg of props.legs) {
    const t = leg.traffic
    if (!t || leg.error) continue
    legsWithTraffic++
    totalDurationSec += t.durationSeconds
    if (t.typicalDurationSeconds != null) {
      totalTypicalSec += t.typicalDurationSeconds
      typicalCount++
    }
    if (t.congestedDurationFraction != null && t.durationSeconds > 0) {
      weightedCongestion += t.congestedDurationFraction * t.durationSeconds
      congWeight += t.durationSeconds
    }
  }

  const avgCongestionFrac = congWeight > 0 ? weightedCongestion / congWeight : null
  const totalDelaySec =
    typicalCount > 0 ? totalDurationSec - totalTypicalSec : null

  return {
    totalDurationSec,
    totalTypicalSec,
    totalDelaySec,
    hasTypical: typicalCount > 0,
    avgCongestionFrac,
    legsWithTraffic,
  }
})

const maxBarMinutes = computed(() => {
  const a = trafficAggregate.value
  const cur = a.totalDurationSec / 60
  const typ = a.totalTypicalSec / 60
  return Math.max(cur, typ, 1)
})

function trafficTier(congestedFraction: number | null): {
  label: string
  hint: string
  accent: string
} {
  if (congestedFraction == null)
    return {
      label: '—',
      hint: 'No data',
      accent: 'border-slate-600/80 bg-slate-800/50 text-slate-400',
    }
  const pct = Math.round(congestedFraction * 100)
  if (pct >= 45)
    return {
      label: 'Heavy',
      hint: `${pct}% of drive in slow traffic`,
      accent: 'border-rose-500/50 bg-rose-950/40 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    }
  if (pct >= 25)
    return {
      label: 'Busy',
      hint: `${pct}% in congestion`,
      accent: 'border-amber-500/50 bg-amber-950/35 text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.2)]',
    }
  if (pct >= 10)
    return {
      label: 'Light',
      hint: `${pct}% light slowdowns`,
      accent: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-100',
    }
  return {
    label: 'Clear',
    hint: pct <= 0 ? 'Mostly free-flowing' : `${pct}% minor delays`,
    accent: 'border-emerald-500/40 bg-emerald-950/35 text-emerald-100',
  }
}

function delayLine(delaySeconds: number | null): string | null {
  if (delaySeconds == null) return null
  const min = delaySeconds / 60
  if (Math.abs(min) < 0.05) return 'Matches a normal day'
  if (min > 0) return `${min.toFixed(1)} min slower than usual`
  return `${Math.abs(min).toFixed(1)} min quicker than usual`
}

const mixSegments = computed(() => {
  const total = props.totalBurden
  if (total <= 0) return [] as Array<ScoreDashboardLeg & { widthPct: number }>
  return props.legs
    .filter((l: ScoreDashboardLeg) => l.weighted != null && l.weighted > 0 && !l.error)
    .map((l: ScoreDashboardLeg) => ({
      ...l,
      widthPct: ((l.weighted as number) / total) * 100,
    }))
})

const congestionChartLegs = computed(() => {
  return props.legs
    .filter((l) => l.traffic && !l.error && l.traffic!.congestedDurationFraction != null)
    .map((l) => ({
      leg: l,
      frac: l.traffic!.congestedDurationFraction as number,
    }))
})

const maxCongestionFrac = computed(() => {
  const m = Math.max(0.08, ...congestionChartLegs.value.map((x) => x.frac))
  return m
})

/** Transit mode: walking-profile routes; walkDetourFactor = path length ÷ straight-line distance. */
const transitAccessAggregate = computed(() => {
  let totalDurationSec = 0
  let weightedDetour = 0
  let detourWeight = 0
  let legsWithDetour = 0

  for (const leg of props.legs) {
    const t = leg.traffic
    if (!t || leg.error || t.walkDetourFactor == null) continue
    legsWithDetour++
    totalDurationSec += t.durationSeconds
    if (t.durationSeconds > 0) {
      weightedDetour += t.walkDetourFactor * t.durationSeconds
      detourWeight += t.durationSeconds
    }
  }

  const avgDetour = detourWeight > 0 ? weightedDetour / detourWeight : null
  return { totalDurationSec, avgDetour, legsWithDetour }
})

const detourChartLegs = computed(() => {
  return props.legs
    .filter((l) => l.traffic && !l.error && l.traffic!.walkDetourFactor != null)
    .map((l) => ({
      leg: l,
      factor: l.traffic!.walkDetourFactor as number,
    }))
})

const maxDetourFactor = computed(() => {
  const m = Math.max(1.05, ...detourChartLegs.value.map((x) => x.factor))
  return m
})

function extraWalkPercent(factor: number): number {
  return Math.max(0, Math.round((factor - 1) * 100))
}

function formatDetourMultiplier(factor: number | null): string {
  if (factor == null) return '—'
  return `${factor.toFixed(2)}×`
}

function detourTier(factor: number | null): {
  label: string
  hint: string
  accent: string
} {
  if (factor == null)
    return {
      label: '—',
      hint: 'No data',
      accent: 'border-slate-600/80 bg-slate-800/50 text-slate-400',
    }
  const pct = extraWalkPercent(factor)
  if (factor >= 1.45)
    return {
      label: 'Long way round',
      hint:
        pct >= 50
          ? 'The path you walk is much longer than a straight line from home — lots of detours or blocks.'
          : `About ${pct}% more walking than a straight line from home.`,
      accent: 'border-rose-500/50 bg-rose-950/40 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    }
  if (factor >= 1.22)
    return {
      label: 'Lots of corners',
      hint: `About ${pct}% more walking than a straight line — extra blocks or turns along the way.`,
      accent: 'border-indigo-500/45 bg-indigo-950/35 text-indigo-100',
    }
  return {
    label: 'Fairly straight',
    hint:
      pct <= 3
        ? 'Almost as direct as a straight line from home.'
        : `Only about ${pct}% more walking than a straight line.`,
    accent: 'border-emerald-500/40 bg-emerald-950/35 text-emerald-100',
  }
}
</script>

<template>
  <div :class="compact ? 'space-y-6' : 'space-y-8'">
    <!-- Hero — dark glass / cyan accent (full dashboard only) -->
    <div
      v-if="!compact"
      class="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/90 p-6 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8"
    >
      <div
        class="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-cyan-500/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-violet-600/10 blur-3xl"
        aria-hidden="true"
      />

      <div class="relative flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div class="relative grid place-items-center">
            <svg
              class="size-36 text-slate-800 sm:size-44"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle cx="50" cy="50" :r="R" fill="none" stroke="currentColor" stroke-width="7" class="text-slate-800" />
              <circle
                cx="50"
                cy="50"
                :r="R"
                fill="none"
                :stroke="`url(#scoreGrad-${uid})`"
                stroke-width="7"
                stroke-linecap="round"
                :stroke-dasharray="String(CIRC)"
                :stroke-dashoffset="scoreDashOffset"
                transform="rotate(-90 50 50)"
                class="transition-[stroke-dashoffset] duration-700 ease-out drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]"
              />
              <defs>
                <linearGradient :id="`scoreGrad-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#22d3ee" />
                  <stop offset="55%" stop-color="#a78bfa" />
                  <stop offset="100%" stop-color="#fbbf24" />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p class="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">
                {{ lifeScore }}
              </p>
              <p class="mt-1 text-[10px] font-medium uppercase tracking-wider text-cyan-200/70">
                out of 100
              </p>
            </div>
          </div>
          <div class="max-w-md text-center sm:text-left">
            <p class="text-xs font-semibold uppercase tracking-widest text-cyan-400/90">
              Life score
            </p>
            <p class="mt-1 text-lg font-semibold text-white">
              {{ scoreLabel }}
            </p>
            <p class="mt-3 text-sm leading-relaxed text-slate-400">
              {{ insight }}
            </p>
            <p
              v-if="travelMode === 'transit'"
              class="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 text-[11px] leading-snug text-amber-100/90"
            >
              We show <strong class="font-semibold text-amber-50">walking time</strong> and, when we have it,
              <strong class="font-semibold text-amber-50">public transit time</strong> for each place. Your score uses
              whichever fits that trip — quick walks stay on foot; longer legs switch to transit only when it’s clearly
              faster.
            </p>
            <div
              class="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-inner"
            >
              <Icon name="lucide:calendar-days" class="size-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
              <span v-if="yearlyTravelChip" class="tabular-nums">{{ yearlyTravelChip }}</span>
              <span v-else class="text-slate-500">Yearly time unavailable</span>
              <span v-if="yearlyTravelChip" class="text-slate-500">· modeled trip frequency</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mix -->
    <div
      v-if="mixSegments.length"
      class="rounded-2xl border border-cyan-500/20 bg-slate-950/85 p-5 text-slate-100 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6"
    >
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-white">
            What matters most for this score
          </h3>
          <p class="mt-1 text-xs text-slate-400">
            Each color is a place. Width shows what share of the hassle comes from that trip (time × how important you said the place is).
          </p>
        </div>
      </div>
      <div
        class="mt-4 flex h-4 w-full overflow-hidden rounded-full ring-1 ring-inset ring-slate-700"
        role="img"
        aria-label="How much each stop contributes to the overall score"
      >
        <div
          v-for="seg in mixSegments"
          :key="seg.anchorId"
          class="h-full min-w-px transition-all"
          :class="categorySegmentClass(seg.category)"
          :style="{ width: seg.widthPct + '%' }"
          :title="seg.name + ': ' + Math.round(seg.widthPct) + '%'"
        />
      </div>
      <ul class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400">
        <li v-for="seg in mixSegments" :key="'leg-' + seg.anchorId" class="flex items-center gap-1.5">
          <span class="size-2 shrink-0 rounded-full" :class="categorySegmentClass(seg.category)" />
          <span class="font-medium text-slate-200">
            {{ seg.name }}
          </span>
          <span class="tabular-nums opacity-80">{{ Math.round(seg.widthPct) }}%</span>
        </li>
      </ul>
    </div>

    <!-- Times (left) vs score impact (right) on large screens; stacked on small -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-7">
      <div class="rounded-2xl border border-cyan-500/20 bg-slate-950/85 p-5 backdrop-blur-xl sm:p-6">
        <div class="flex items-start gap-2">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
            <Icon name="lucide:timer" class="size-4 text-cyan-400" aria-hidden="true" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-white">
              {{ travelMode === 'transit' ? 'Commute time to each place' : 'Drive or walk time' }}
            </h3>
            <p class="mt-0.5 text-xs text-slate-400">
              <template v-if="travelMode === 'transit'">
                One way from home. Each row lists walk and transit times when both exist; the bold number is what counted
                toward your score.
              </template>
              <template v-else> One-way minutes from home ({{ travelMode }}). </template>
            </p>
          </div>
        </div>
        <ul class="mt-5 space-y-4" role="list">
          <li v-for="leg in legs" :key="'m-' + leg.anchorId" class="space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="flex min-w-0 items-center gap-1.5 font-medium text-slate-200">
                <Icon
                  :name="categoryIconName(leg.category)"
                  class="size-3.5 shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span class="truncate">{{ leg.name }}</span>
              </span>
              <span v-if="leg.error" class="shrink-0 text-red-400">—</span>
              <span v-else class="shrink-0 tabular-nums text-cyan-200/90">
                {{ leg.minutes != null ? leg.minutes.toFixed(1) + ' min' : '—' }}
              </span>
            </div>
            <div
              v-if="travelMode === 'transit' && leg.traffic && !leg.error"
              class="rounded-md border border-slate-700/80 bg-slate-900/50 px-2.5 py-2 text-[11px] leading-snug text-slate-400"
            >
              <p v-if="leg.traffic.walkCommuteSeconds != null" class="tabular-nums">
                <span class="text-slate-500">Walk:</span>
                {{ (leg.traffic.walkCommuteSeconds / 60).toFixed(1) }} min
              </p>
              <p v-if="leg.traffic.transitCommuteSeconds != null" class="mt-0.5 tabular-nums">
                <span class="text-slate-500">Public transit (estimate):</span>
                {{ (leg.traffic.transitCommuteSeconds / 60).toFixed(1) }} min
              </p>
              <p v-else-if="leg.traffic.walkCommuteSeconds != null" class="mt-0.5 text-slate-500">
                No transit estimate for this trip.
              </p>
              <p v-if="leg.traffic.commuteChoiceNote" class="mt-1.5 text-slate-300">
                {{ leg.traffic.commuteChoiceNote }}
              </p>
              <p class="mt-1.5 font-medium text-cyan-200/95 tabular-nums">
                <span class="font-normal text-slate-500">Counted for score:</span>
                {{ leg.minutes != null ? leg.minutes.toFixed(1) + ' min' : '—' }}
                <span v-if="leg.traffic.commuteModeUsed === 'transit'" class="font-normal text-slate-500">
                  · transit
                </span>
                <span v-else-if="leg.traffic.commuteModeUsed === 'walk'" class="font-normal text-slate-500">
                  · walking
                </span>
              </p>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                v-if="!leg.error && leg.minutes != null"
                class="h-full rounded-full bg-gradient-to-r transition-all duration-500"
                :class="categoryBarClass(leg.category)"
                :style="{ width: barPct(leg.minutes, maxMinutes) + '%' }"
              />
            </div>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-violet-500/20 bg-slate-950/85 p-5 backdrop-blur-xl sm:p-6">
        <div class="flex items-start gap-2">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
            <Icon name="lucide:percent" class="size-4 text-violet-300" aria-hidden="true" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-white">
              How much each place moves the score
            </h3>
            <p class="mt-0.5 text-xs text-slate-400">
              The big percentages are the trips that drag your score up or down — longer trips and places you marked more important count more.
            </p>
          </div>
        </div>

        <!-- Donut: multiple grocery stops are separate wedges (green shades); legend matches -->
        <div v-if="legBurdenSlices.length" class="mt-5 border-t border-violet-500/15 pt-5">
          <div
            class="flex w-full min-w-0 flex-col gap-5 rounded-xl border border-violet-500/10 bg-violet-950/20 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-5"
          >
            <div class="relative mx-auto shrink-0 sm:mx-0">
              <svg
                class="size-[150px] drop-shadow-[0_0_24px_rgba(139,92,246,0.2)]"
                :viewBox="`0 0 ${donutBox} ${donutBox}`"
                role="img"
                aria-label="Share of total burden by place"
              >
                <circle
                  :cx="donutBox / 2"
                  :cy="donutBox / 2"
                  :r="(donutR.inner + donutR.outer) / 2"
                  fill="none"
                  stroke="rgb(15 23 42 / 0.9)"
                  :stroke-width="donutR.outer - donutR.inner + 4"
                />
                <path
                  v-for="(p, pi) in donutPathsForLegs"
                  :key="'move-donut-' + pi"
                  :d="p.d"
                  :fill="p.color"
                  stroke="rgb(15 23 42)"
                  stroke-width="1"
                  opacity="0.95"
                />
                <text
                  :x="donutBox / 2"
                  :y="donutBox / 2 - 4"
                  text-anchor="middle"
                  class="fill-white text-lg font-bold tabular-nums"
                >
                  {{ lifeScore }}
                </text>
                <text
                  :x="donutBox / 2"
                  :y="donutBox / 2 + 12"
                  text-anchor="middle"
                  class="fill-slate-500 text-[9px] uppercase tracking-wide"
                >
                  life score
                </text>
              </svg>
            </div>
            <ul class="min-w-0 flex-1 space-y-1.5 text-[11px] sm:pt-0.5">
              <li
                v-for="(leg, di) in legsForDonut"
                :key="'donut-leg-' + leg.anchorId"
                class="flex items-center justify-between gap-3"
              >
                <span class="flex min-w-0 items-center gap-2 text-slate-400">
                  <span
                    class="size-2.5 shrink-0 rounded-sm ring-1 ring-slate-700"
                    :style="{ backgroundColor: donutLegendColor(leg, di) }"
                  />
                  <span class="break-words leading-snug">{{ leg.name }}</span>
                </span>
                <span class="shrink-0 tabular-nums font-medium text-slate-200">
                  {{ sharePct(leg.weighted) }}%
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Driving: summary + skyline chart + tier cards (not compact) -->
    <div
      v-if="travelMode === 'driving' && !compact"
      class="space-y-5 rounded-2xl border border-amber-500/20 bg-slate-950/90 p-4 shadow-[0_0_36px_rgba(251,191,36,0.06)] backdrop-blur-xl sm:space-y-5 sm:p-5"
    >
      <div class="flex flex-wrap items-start gap-2.5">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.15)] sm:size-10">
          <Icon name="lucide:car-front" class="size-[1.15rem] text-amber-300 sm:size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold text-white">Traffic snapshot</h3>
          <p class="mt-0.5 text-xs leading-snug text-slate-400">
            One overview for all routes, then how rough each leg feels. Map lines still match these drive times.
          </p>
        </div>
      </div>

      <template v-if="trafficAggregate.legsWithTraffic > 0">
        <!-- Summary tiles -->
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            class="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur-sm"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">All legs now</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-cyan-300">
              {{ (trafficAggregate.totalDurationSec / 60).toFixed(0) }}
              <span class="text-sm font-medium text-slate-500">min</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">Total one-way time</p>
          </div>
          <div
            v-if="trafficAggregate.hasTypical"
            class="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur-sm"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Same trips, usual day</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-amber-200/90">
              {{ (trafficAggregate.totalTypicalSec / 60).toFixed(0) }}
              <span class="text-sm font-medium text-slate-500">min</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">Typical traffic baseline</p>
          </div>
          <div
            v-if="trafficAggregate.totalDelaySec != null"
            class="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur-sm"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Compared to usual</p>
            <p
              class="mt-1 text-2xl font-bold tabular-nums"
              :class="trafficAggregate.totalDelaySec > 60 ? 'text-rose-300' : trafficAggregate.totalDelaySec < -60 ? 'text-emerald-300' : 'text-slate-200'"
            >
              {{ trafficAggregate.totalDelaySec >= 0 ? '+' : '' }}{{ (trafficAggregate.totalDelaySec / 60).toFixed(1) }}
              <span class="text-sm font-medium text-slate-500">min</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">Across every route shown</p>
          </div>
        </div>

        <!-- Usual vs now — twin towers -->
        <div v-if="trafficAggregate.hasTypical" class="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <p class="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Total time — usual vs right now
          </p>
          <div class="mx-auto mt-4 flex max-w-md items-end justify-center gap-6 sm:gap-10">
            <div class="flex flex-col items-center gap-2">
              <div
                class="flex w-14 items-end justify-center rounded-t-lg bg-gradient-to-t from-amber-900/40 to-amber-500/50 sm:w-16"
                :style="{
                  height:
                    48 +
                    (trafficAggregate.totalTypicalSec / 60 / maxBarMinutes) * 120 +
                    'px',
                }"
              >
                <span class="mb-2 text-xs font-bold tabular-nums text-amber-100">
                  {{ (trafficAggregate.totalTypicalSec / 60).toFixed(0) }}
                </span>
              </div>
              <span class="text-[11px] font-medium text-amber-200/80">Usual</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <div
                class="flex w-14 items-end justify-center rounded-t-lg bg-gradient-to-t from-cyan-950/50 to-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.25)] sm:w-16"
                :style="{
                  height:
                    48 +
                    (trafficAggregate.totalDurationSec / 60 / maxBarMinutes) * 120 +
                    'px',
                }"
              >
                <span class="mb-2 text-xs font-bold tabular-nums text-cyan-50">
                  {{ (trafficAggregate.totalDurationSec / 60).toFixed(0) }}
                </span>
              </div>
              <span class="text-[11px] font-medium text-cyan-300/90">Now</span>
            </div>
          </div>
        </div>

        <!-- Congestion skyline: header isolated so tall bars never overlap copy -->
        <div v-if="congestionChartLegs.length" class="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5 sm:pt-3">
          <div class="relative z-10 border-b border-slate-700/50 pb-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Where time is lost to congestion
            </p>
            <p class="mt-0.5 text-xs text-slate-500">
              Taller bar = more of that drive spent in slow traffic.
            </p>
          </div>
          <div
            class="mt-3 flex min-h-[9.5rem] items-end justify-between gap-1 overflow-hidden px-0.5 sm:min-h-[10rem] sm:gap-2"
            role="img"
            aria-label="Congestion share by destination"
          >
            <div
              v-for="{ leg, frac } in congestionChartLegs"
              :key="'cv-' + leg.anchorId"
              class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <div
                class="w-full max-w-[3rem] shrink-0 rounded-t-md bg-gradient-to-t from-slate-900 via-slate-800 to-cyan-400 shadow-[0_-4px_16px_rgba(34,211,238,0.25)] transition-all sm:max-w-[4rem]"
                :style="{
                  height: `${8 + (frac / maxCongestionFrac) * 92}px`,
                  maxHeight: '100px',
                }"
              />
              <Icon
                :name="categoryIconName(leg.category)"
                class="size-4 shrink-0 text-slate-500"
                aria-hidden="true"
              />
              <span class="line-clamp-2 w-full text-center text-[9px] leading-tight text-slate-500">{{ leg.name }}</span>
            </div>
          </div>
        </div>

        <!-- Per-leg: tier cards only (no duplicate bars) -->
        <div>
          <p class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Each destination</p>
          <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
            <li
              v-for="leg in legs"
              :key="'tier-' + leg.anchorId"
              class="rounded-xl border px-4 py-3 backdrop-blur-sm transition-shadow"
              :class="leg.traffic && !leg.error ? trafficTier(leg.traffic.congestedDurationFraction).accent : 'border-slate-700 bg-slate-900/50 text-slate-400'"
            >
              <div class="flex items-center gap-2">
                <Icon :name="categoryIconName(leg.category)" class="size-4 opacity-80" aria-hidden="true" />
                <span class="truncate text-xs font-semibold text-white">{{ leg.name }}</span>
              </div>
              <template v-if="leg.traffic && !leg.error">
                <p class="mt-2 text-lg font-bold tracking-wide text-white">
                  {{ trafficTier(leg.traffic.congestedDurationFraction).label }}
                </p>
                <p class="mt-1 text-[11px] leading-snug opacity-90">
                  {{ trafficTier(leg.traffic.congestedDurationFraction).hint }}
                </p>
                <p v-if="delayLine(leg.traffic.delayVsTypicalSeconds)" class="mt-2 text-[11px] text-slate-300">
                  {{ delayLine(leg.traffic.delayVsTypicalSeconds) }}
                </p>
                <p v-if="leg.traffic.distanceKm != null" class="mt-1 text-[10px] text-slate-500">
                  ≈ {{ leg.traffic.distanceKm.toFixed(1) }} km one-way
                </p>
              </template>
              <p v-else class="mt-2 text-[11px] text-slate-500">No traffic detail for this leg.</p>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="text-sm text-slate-500">No driving traffic data for these routes yet.</p>
    </div>

    <div
      v-else-if="travelMode === 'transit' && !compact"
      class="space-y-5 rounded-2xl border border-indigo-500/25 bg-slate-950/90 p-4 shadow-[0_0_36px_rgba(99,102,241,0.08)] backdrop-blur-xl sm:space-y-5 sm:p-5"
    >
      <div class="flex flex-wrap items-start gap-2.5">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 sm:size-10">
          <Icon name="lucide:train-front" class="size-[1.15rem] text-indigo-300 sm:size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold text-white">Street access snapshot</h3>
          <p class="mt-0.5 text-xs leading-snug text-slate-400">
            The <strong class="font-medium text-slate-300">Each destination</strong> cards list walk and transit minutes
            (when we have both) and what counted for your score. Below, detour compares each
            <strong class="font-medium text-slate-300">walking path</strong> to a straight line between the same
            points—how direct the walk is, similar to how we show congestion for driving. Turn on
            <span class="font-medium text-indigo-200/85">Show transit on map</span> for rail and ferry lines on the map.
          </p>
        </div>
      </div>

      <template v-if="transitAccessAggregate.legsWithDetour > 0">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur-sm">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">All legs (commute)</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-cyan-300">
              {{ (transitAccessAggregate.totalDurationSec / 60).toFixed(0) }}
              <span class="text-sm font-medium text-slate-500">min</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">Total one-way time (walk or transit, per our rules)</p>
          </div>
          <div
            v-if="transitAccessAggregate.avgDetour != null"
            class="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 backdrop-blur-sm"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg detour factor</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-indigo-200">
              {{ formatDetourMultiplier(transitAccessAggregate.avgDetour) }}
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">
              Walk route length ÷ straight line, weighted by time on each leg (walking geometry only)
            </p>
          </div>
        </div>

        <div v-if="detourChartLegs.length" class="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5 sm:pt-3">
          <div class="relative z-10 border-b border-slate-700/50 pb-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Which stops mean the most out-of-the-way walking?
            </p>
            <p class="mt-0.5 text-xs text-slate-500">
              Taller bar = more extra distance compared with a straight line from home.
            </p>
          </div>
          <div
            class="mt-3 flex min-h-[9.5rem] items-end justify-between gap-1 overflow-hidden px-0.5 sm:min-h-[10rem] sm:gap-2"
            role="img"
            aria-label="Extra walking distance by destination"
          >
            <div
              v-for="{ leg, factor } in detourChartLegs"
              :key="'dv-' + leg.anchorId"
              class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <div
                class="w-full max-w-[3rem] shrink-0 rounded-t-md bg-gradient-to-t from-slate-900 via-slate-800 to-indigo-400 shadow-[0_-4px_16px_rgba(129,140,248,0.25)] transition-all sm:max-w-[4rem]"
                :style="{
                  height: `${8 + ((factor - 1) / Math.max(0.35, maxDetourFactor - 1)) * 92}px`,
                  maxHeight: '100px',
                }"
              />
              <Icon
                :name="categoryIconName(leg.category)"
                class="size-4 shrink-0 text-slate-500"
                aria-hidden="true"
              />
              <span class="line-clamp-2 w-full text-center text-[9px] leading-tight text-slate-500">{{ leg.name }}</span>
            </div>
          </div>
        </div>

        <div>
          <p class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Each destination</p>
          <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
            <li
              v-for="leg in legs"
              :key="'dt-' + leg.anchorId"
              class="rounded-xl border px-4 py-3 backdrop-blur-sm transition-shadow"
              :class="
                leg.traffic && !leg.error && leg.traffic.walkDetourFactor != null
                  ? detourTier(leg.traffic.walkDetourFactor).accent
                  : 'border-slate-700 bg-slate-900/50 text-slate-400'
              "
            >
              <div class="flex items-center gap-2">
                <Icon :name="categoryIconName(leg.category)" class="size-4 opacity-80" aria-hidden="true" />
                <span class="truncate text-xs font-semibold text-white">{{ leg.name }}</span>
              </div>
              <template v-if="leg.traffic && !leg.error">
                <template v-if="leg.traffic.walkDetourFactor != null">
                  <p class="mt-2 text-lg font-bold tracking-wide text-white">
                    {{ detourTier(leg.traffic.walkDetourFactor).label }}
                  </p>
                  <p class="mt-1 text-[11px] leading-snug opacity-90">
                    {{ detourTier(leg.traffic.walkDetourFactor).hint }}
                  </p>
                </template>
                <div v-if="leg.traffic.walkCommuteSeconds != null" class="mt-3 space-y-1 border-t border-white/10 pt-2.5 text-[11px]">
                  <p class="tabular-nums text-slate-200">
                    <span class="text-slate-500">Walk</span>
                    · {{ (leg.traffic.walkCommuteSeconds / 60).toFixed(1) }} min one-way
                  </p>
                  <p v-if="leg.traffic.transitCommuteSeconds != null" class="tabular-nums text-slate-200">
                    <span class="text-slate-500">Public transit</span>
                    · {{ (leg.traffic.transitCommuteSeconds / 60).toFixed(1) }} min one-way
                  </p>
                  <p
                    v-if="leg.minutes != null && leg.traffic.commuteModeUsed === 'walk' && leg.traffic.transitCommuteSeconds != null"
                    class="text-[10px] leading-snug text-slate-400"
                  >
                    We counted walking; transit would be about {{ (leg.traffic.transitCommuteSeconds / 60).toFixed(1) }} min.
                  </p>
                  <p v-if="leg.minutes != null" class="font-semibold tabular-nums text-cyan-200/95">
                    Counted for score · {{ leg.minutes.toFixed(1) }} min
                    <span v-if="leg.traffic.commuteModeUsed === 'transit'" class="font-normal text-slate-400">· transit</span>
                    <span v-else-if="leg.traffic.commuteModeUsed === 'walk'" class="font-normal text-slate-400">· walking</span>
                  </p>
                  <p v-if="leg.traffic.commuteChoiceNote" class="text-[10px] leading-snug text-slate-400">
                    {{ leg.traffic.commuteChoiceNote }}
                  </p>
                </div>
                <p v-if="leg.traffic.distanceKm != null" class="mt-2 text-[10px] text-slate-500">
                  ≈ {{ leg.traffic.distanceKm.toFixed(1) }} km one-way along the path
                </p>
              </template>
              <p v-else class="mt-2 text-[11px] text-slate-500">No extra detail for this stop.</p>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="text-sm text-slate-500">No walking-path detail for these routes yet.</p>
    </div>

    <div
      v-else-if="!compact"
      class="rounded-2xl border border-dashed border-cyan-500/25 bg-slate-950/60 p-5 text-center backdrop-blur-xl sm:p-6"
    >
      <Icon name="lucide:footprints" class="mx-auto size-8 text-cyan-600/50" aria-hidden="true" />
      <p class="mt-2 text-sm font-medium text-slate-200">Walking &amp; cycling</p>
      <p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
        Congestion detail is for driving only. The times above follow your {{ travelMode }} choice for each trip.
      </p>
    </div>
  </div>
</template>
