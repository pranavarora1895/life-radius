<script setup lang="ts">
import type { AnchorCategory, ScenarioCompareCategoryRow, ScenarioCompareSnapshot } from '~/types'
import { categoryIconName } from '~/utils/categoryIcons'
import { buildDonutPaths, burdenSlicesForSnapshot, CATEGORY_HEX } from '~/utils/compareCharts'
import { categoryDisplayName, formatYearlyTravelCompact } from '~/utils/scoreExplain'
import { categoriesPresentInSnapshots } from '~/utils/scenarioCompare'

const props = defineProps<{
  snapshots: ScenarioCompareSnapshot[]
}>()

const palette = [
  {
    bar: 'from-cyan-400 to-cyan-500',
    stroke: 'stroke-cyan-400',
    fill: 'fill-cyan-400',
    dot: 'bg-cyan-400',
    text: 'text-cyan-100',
    card: 'border-cyan-500/35 bg-gradient-to-b from-cyan-950/40 to-slate-950/90 shadow-[0_0_40px_rgba(34,211,238,0.12)]',
    ring: 'ring-cyan-500/30',
    hex: '#22d3ee',
  },
  {
    bar: 'from-violet-400 to-violet-500',
    stroke: 'stroke-violet-400',
    fill: 'fill-violet-400',
    dot: 'bg-violet-400',
    text: 'text-violet-100',
    card: 'border-violet-500/35 bg-gradient-to-b from-violet-950/40 to-slate-950/90 shadow-[0_0_40px_rgba(139,92,246,0.12)]',
    ring: 'ring-violet-500/30',
    hex: '#a78bfa',
  },
  {
    bar: 'from-amber-400 to-amber-500',
    stroke: 'stroke-amber-400',
    fill: 'fill-amber-400',
    dot: 'bg-amber-400',
    text: 'text-amber-100',
    card: 'border-amber-500/35 bg-gradient-to-b from-amber-950/35 to-slate-950/90 shadow-[0_0_40px_rgba(245,158,11,0.1)]',
    ring: 'ring-amber-500/30',
    hex: '#fbbf24',
  },
] as const

function pal(index: number) {
  return palette[index % 3] as (typeof palette)[number]
}

const categories = computed(() => categoriesPresentInSnapshots(props.snapshots))

function weightedFor(snapshot: ScenarioCompareSnapshot, category: AnchorCategory) {
  const row = snapshot.byCategory.find((r: ScenarioCompareCategoryRow) => r.category === category)
  return row?.weightedSum ?? 0
}

const maxBurden = computed(() =>
  Math.max(1, ...props.snapshots.map((s: ScenarioCompareSnapshot) => s.totalBurden)),
)

const maxYearly = computed(() =>
  Math.max(1, ...props.snapshots.map((s: ScenarioCompareSnapshot) => s.yearlyTravelMinutes)),
)

function maxWeightedForCategory(cat: AnchorCategory) {
  return Math.max(
    0.001,
    ...props.snapshots.map((s: ScenarioCompareSnapshot) => weightedFor(s, cat)),
  )
}

function pct(value: number, max: number) {
  if (max <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

function scoreTierLabel(score: number) {
  if (score >= 75) return 'Strong convenience'
  if (score >= 55) return 'Solid overall'
  if (score >= 40) return 'Room to improve'
  return 'Heavy friction'
}

const bestLifeIndex = computed(() => {
  const list = props.snapshots
  if (!list.length) return -1
  let best = 0
  let max = list[0]!.lifeScore
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.lifeScore > max) {
      max = list[i]!.lifeScore
      best = i
    }
  }
  return best
})

const bestBurdenIndex = computed(() => {
  const list = props.snapshots
  if (!list.length) return -1
  let best = 0
  let min = list[0]!.totalBurden
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.totalBurden < min) {
      min = list[i]!.totalBurden
      best = i
    }
  }
  return best
})

const bestYearlyIndex = computed(() => {
  const list = props.snapshots
  if (!list.length) return -1
  let best = 0
  let min = list[0]!.yearlyTravelMinutes
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.yearlyTravelMinutes < min) {
      min = list[i]!.yearlyTravelMinutes
      best = i
    }
  }
  return best
})

/** Donut per scenario */
const donutR = { inner: 38, outer: 62 }
const donutBox = 150

function donutPathsFor(sn: ScenarioCompareSnapshot) {
  const slices = burdenSlicesForSnapshot(sn)
  return buildDonutPaths(slices, donutBox / 2, donutBox / 2, donutR.inner, donutR.outer)
}

/** Radar: need ≥3 axes */
const showRadar = computed(() => categories.value.length >= 3)
/** Plot is square; padding keeps outer labels inside the SVG (avoids clipping). */
const radarPad = 44
const radarSize = 268
const radarViewSize = radarSize + 2 * radarPad
const radarCx = radarSize / 2
const radarCy = radarSize / 2
const radarMinR = 36
const radarMaxR = 102

function radarVertex(catIndex: number, n: number, norm: number) {
  const angle = -Math.PI / 2 + (catIndex / n) * 2 * Math.PI
  const r = radarMinR + Math.min(1, Math.max(0, norm)) * (radarMaxR - radarMinR)
  return {
    x: radarCx + r * Math.cos(angle),
    y: radarCy + r * Math.sin(angle),
  }
}

function radarPointsString(sn: ScenarioCompareSnapshot): string {
  const cats = categories.value
  const n = cats.length
  if (n < 3) return ''
  return cats
    .map((cat, i) => {
      const raw = weightedFor(sn, cat)
      const mx = maxWeightedForCategory(cat)
      const norm = mx > 0 ? raw / mx : 0
      const p = radarVertex(i, n, norm)
      return `${p.x},${p.y}`
    })
    .join(' ')
}

function radarAxisEnd(catIndex: number, n: number) {
  const angle = -Math.PI / 2 + (catIndex / n) * 2 * Math.PI
  return {
    x: radarCx + radarMaxR * Math.cos(angle),
    y: radarCy + radarMaxR * Math.sin(angle),
  }
}

function radarGridPolygon(tier: number): string {
  const cats = categories.value
  const n = cats.length
  if (n < 3) return ''
  return cats
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI
      const r = radarMinR + tier * (radarMaxR - radarMinR)
      return `${radarCx + r * Math.cos(angle)},${radarCy + r * Math.sin(angle)}`
    })
    .join(' ')
}

function radarLabelPos(catIndex: number, n: number) {
  const end = radarAxisEnd(catIndex, n)
  const dx = end.x - radarCx
  const dy = end.y - radarCy
  const len = Math.hypot(dx, dy) || 1
  /** Extra gap so labels clear the grid; padding on the SVG handles the rest. */
  const scale = (radarMaxR + 32) / len
  return { x: radarCx + dx * scale, y: radarCy + dy * scale }
}

/** Align label away from the chart edge so long names don’t clip (LTR). */
function radarTextAnchor(catIndex: number, n: number): 'start' | 'middle' | 'end' {
  const angle = -Math.PI / 2 + (catIndex / n) * 2 * Math.PI
  const c = Math.cos(angle)
  if (c < -0.3) return 'end'
  if (c > 0.3) return 'start'
  return 'middle'
}

/** Vertical bar charts — wide enough per column so scenario names are not truncated. */
const vChartH = 156
const vChartW = computed(() => Math.max(280, 52 + props.snapshots.length * 96))
const vBaselineY = 124
const vMaxBarH = 92

function vBarHeight(value: number, max: number) {
  return (pct(value, max) / 100) * vMaxBarH
}

function vBarX(index: number, total: number) {
  const slot = (vChartW.value - 48) / total
  return 24 + index * slot + (slot - 36) / 2
}
</script>

<template>
  <div class="space-y-10">
    <div
      v-if="snapshots.length < 2"
      class="rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/50 px-6 py-14 text-center"
    >
      <div
        class="mx-auto flex size-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/80 shadow-inner"
      >
        <Icon name="lucide:git-compare" class="size-8 text-slate-500" aria-hidden="true" />
      </div>
      <p class="mt-5 text-base font-semibold text-slate-100">Compare two or more homes</p>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        Tap <span class="font-medium text-cyan-300/90">+</span> to add another home, set its address, then run
        <span class="font-medium text-cyan-300/90">Calculate Life Score</span> for each. Comparisons unlock once at least
        two homes have a score.
      </p>
    </div>

    <template v-else>
      <!-- Hero cards -->
      <section>
        <h3 class="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Icon name="lucide:sparkles" class="size-4 text-violet-400" aria-hidden="true" />
          At a glance
          <span class="font-normal normal-case text-slate-600">· Life Score and quick stats</span>
        </h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="(sn, si) in snapshots"
            :key="`hero-${sn.scenarioId}`"
            class="relative overflow-hidden rounded-2xl border p-5 transition"
            :class="[pal(si).card, bestLifeIndex === si ? `ring-2 ${pal(si).ring}` : '']"
          >
            <div
              v-if="bestLifeIndex === si"
              class="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
            >
              <Icon name="lucide:trophy" class="size-3" aria-hidden="true" />
              Best score
            </div>
            <div class="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
              <div class="flex shrink-0 justify-center sm:justify-start">
                <LifeScoreSpeedometer
                  embedded
                  :score="sn.lifeScore"
                  :accent-hex="pal(si).hex"
                  :label="sn.label"
                />
              </div>
              <div class="min-w-0 flex-1 pt-0 sm:pt-1">
                <p class="truncate text-sm font-semibold" :class="pal(si).text">{{ sn.label }}</p>
                <p class="mt-1 flex flex-wrap items-baseline gap-2">
                  <span class="text-2xl font-bold tabular-nums tracking-tight text-white">{{ sn.lifeScore }}</span>
                  <span class="text-xs font-medium text-slate-500">/ 100</span>
                  <span class="text-[11px] text-slate-500">· {{ scoreTierLabel(sn.lifeScore) }}</span>
                </p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span
                    class="inline-flex items-center gap-1 rounded-md border border-slate-600/80 bg-slate-950/60 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-300"
                  >
                    <Icon name="lucide:route" class="size-3 text-slate-500" aria-hidden="true" />
                    {{ sn.travelMode }}
                  </span>
                </div>
                <dl class="mt-3 space-y-2 border-t border-slate-800/80 pt-3 text-[11px]">
                  <div class="flex justify-between gap-2">
                    <dt class="text-slate-500">Yearly travel</dt>
                    <dd class="text-right font-medium tabular-nums text-slate-200">
                      {{ formatYearlyTravelCompact(sn.yearlyTravelMinutes) || '—' }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt class="text-slate-500">Total burden</dt>
                    <dd class="flex items-center gap-1.5 text-right tabular-nums text-slate-200">
                      {{ sn.totalBurden.toFixed(1) }}
                      <span
                        v-if="bestBurdenIndex === si"
                        class="inline-flex"
                        title="Lowest burden in this comparison"
                      >
                        <Icon
                          name="lucide:check-circle-2"
                          class="size-3.5 shrink-0 text-emerald-400"
                          aria-hidden="true"
                        />
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Donut: % of burden by place type -->
      <section class="rounded-2xl border border-fuchsia-500/20 bg-slate-950/80 p-5 sm:p-6">
        <div class="mb-6">
          <h3 class="flex items-center gap-2 text-base font-semibold text-white">
            <Icon name="lucide:pie-chart" class="size-5 text-fuchsia-400" aria-hidden="true" />
            What moves each score
          </h3>
          <p class="mt-1 max-w-2xl text-sm text-slate-300">
            Each ring is the full errand load for that home. Bigger slices mean more of the hassle comes from that kind of
            trip. Several grocery stops are combined into one grocery share; the small chart under each home splits
            groceries by store when there’s more than one.
          </p>
        </div>

        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(sn, si) in snapshots"
            :key="`donut-${sn.scenarioId}`"
            class="flex flex-col items-center rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-5"
          >
            <p class="mb-3 max-w-full truncate text-center text-sm font-semibold" :class="pal(si).text">
              {{ sn.label }}
            </p>
            <div class="relative">
              <svg
                class="size-[150px] drop-shadow-[0_0_24px_rgba(0,0,0,0.45)]"
                :viewBox="`0 0 ${donutBox} ${donutBox}`"
                role="img"
                :aria-label="`Burden mix for ${sn.label}`"
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
                  v-for="(p, pi) in donutPathsFor(sn)"
                  :key="`${sn.scenarioId}-d-${pi}`"
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
                  {{ sn.lifeScore }}
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
            <ul class="mt-4 w-full max-w-[220px] space-y-1.5 text-left">
              <li
                v-for="sl in burdenSlicesForSnapshot(sn)"
                :key="sn.scenarioId + sl.category"
                class="flex items-center justify-between gap-2 text-[11px]"
              >
                <span class="flex min-w-0 items-center gap-2 text-slate-400">
                  <span class="size-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: sl.color }" />
                  <span class="truncate">{{ sl.label }}</span>
                </span>
                <span class="shrink-0 tabular-nums font-medium text-slate-200">{{ sl.pct.toFixed(1) }}%</span>
              </li>
            </ul>
            <GrocerySunburstChart :legs="sn.groceryLegs" />
          </div>
        </div>
      </section>

      <!-- Radar: shape of burden by category -->
      <section
        v-if="showRadar"
        class="rounded-2xl border border-sky-500/25 bg-slate-950/80 p-5 sm:p-6"
      >
        <div class="mb-4">
          <h3 class="flex items-center gap-2 text-base font-semibold text-white">
            <Icon name="lucide:radar" class="size-5 text-sky-400" aria-hidden="true" />
            Errands by type
          </h3>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
            Each corner is a trip type. Farther from the middle means more of the comparison’s hassle on that home for that
            kind of errand. Touching the outer ring means a tie for the heaviest load here.
          </p>
        </div>
        <div class="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          <svg
            class="shrink-0 overflow-visible"
            :width="radarViewSize"
            :height="radarViewSize"
            :viewBox="`0 0 ${radarViewSize} ${radarViewSize}`"
            role="img"
            aria-label="Radar comparison of burden by category"
          >
            <g :transform="`translate(${radarPad}, ${radarPad})`">
              <polygon
                v-for="tier in [0.25, 0.5, 0.75, 1]"
                :key="`grid-${tier}`"
                :points="radarGridPolygon(tier)"
                fill="none"
                stroke="rgb(51 65 85 / 0.5)"
                stroke-width="1"
              />
              <line
                v-for="(cat, i) in categories"
                :key="`ax-${cat}`"
                :x1="radarCx"
                :y1="radarCy"
                :x2="radarAxisEnd(i, categories.length).x"
                :y2="radarAxisEnd(i, categories.length).y"
                stroke="rgb(51 65 85 / 0.6)"
                stroke-width="1"
              />
              <polygon
                v-for="(sn, si) in snapshots"
                :key="`radar-${sn.scenarioId}`"
                :points="radarPointsString(sn)"
                :fill="pal(si).hex"
                fill-opacity="0.12"
                :stroke="pal(si).hex"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <text
                v-for="(cat, i) in categories"
                :key="`lbl-${cat}`"
                :x="radarLabelPos(i, categories.length).x"
                :y="radarLabelPos(i, categories.length).y"
                :text-anchor="radarTextAnchor(i, categories.length)"
                dominant-baseline="middle"
                class="fill-slate-200 text-[12px] font-semibold"
                style="text-shadow: 0 1px 3px rgb(0 0 0 / 0.9)"
              >
                {{ categoryDisplayName(cat) }}
              </text>
            </g>
          </svg>
          <div class="flex flex-wrap justify-center gap-3 lg:flex-col lg:justify-start">
            <div
              v-for="(sn, si) in snapshots"
              :key="`leg-${sn.scenarioId}`"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2"
            >
              <span class="size-3 rounded-sm" :style="{ backgroundColor: pal(si).hex }" />
              <span class="text-xs font-medium text-slate-200">{{ sn.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Burden & yearly: column charts (different visual from pies) -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-5 sm:p-6">
          <h3 class="mb-1 flex items-center gap-2 text-base font-semibold text-white">
            <Icon name="lucide:weight" class="size-5 text-violet-400" aria-hidden="true" />
            Total burden
          </h3>
          <p class="mb-4 text-sm text-slate-300">Overall errand load—shorter bar is easier day to day.</p>
          <div class="overflow-x-auto">
            <svg
              class="mx-auto"
              :viewBox="`0 0 ${vChartW} ${vChartH}`"
              :style="{ width: '100%', maxWidth: `${vChartW}px` }"
              role="img"
              aria-label="Total burden by scenario"
            >
              <line x1="12" :x2="vChartW - 12" :y1="vBaselineY" :y2="vBaselineY" class="stroke-slate-700" stroke-width="1" />
              <template v-for="(sn, si) in snapshots" :key="`vb-${sn.scenarioId}`">
                <rect
                  :x="vBarX(si, snapshots.length)"
                  :y="vBaselineY - vBarHeight(sn.totalBurden, maxBurden)"
                  width="36"
                  :height="vBarHeight(sn.totalBurden, maxBurden)"
                  rx="6"
                  :fill="pal(si).hex"
                  opacity="0.85"
                />
                <text
                  :x="vBarX(si, snapshots.length) + 18"
                  :y="vBaselineY + 18"
                  text-anchor="middle"
                  class="fill-slate-200 text-[11px] font-medium"
                >
                  {{ sn.label }}
                </text>
                <text
                  :x="vBarX(si, snapshots.length) + 18"
                  :y="vBaselineY - vBarHeight(sn.totalBurden, maxBurden) - 6"
                  text-anchor="middle"
                  class="fill-slate-100 text-xs font-semibold tabular-nums"
                >
                  {{ sn.totalBurden.toFixed(0) }}
                </text>
              </template>
            </svg>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-5 sm:p-6">
          <h3 class="mb-1 flex items-center gap-2 text-base font-semibold text-white">
            <Icon name="lucide:calendar-clock" class="size-5 text-amber-400" aria-hidden="true" />
            Time per year
          </h3>
          <p class="mb-4 text-sm text-slate-300">Estimated annual time on these trips.</p>
          <div class="overflow-x-auto">
            <svg
              class="mx-auto"
              :viewBox="`0 0 ${vChartW} ${vChartH}`"
              :style="{ width: '100%', maxWidth: `${vChartW}px` }"
              role="img"
              aria-label="Yearly travel minutes by scenario"
            >
              <line x1="12" :x2="vChartW - 12" :y1="vBaselineY" :y2="vBaselineY" class="stroke-slate-700" stroke-width="1" />
              <template v-for="(sn, si) in snapshots" :key="`vy-${sn.scenarioId}`">
                <rect
                  :x="vBarX(si, snapshots.length)"
                  :y="vBaselineY - vBarHeight(sn.yearlyTravelMinutes, maxYearly)"
                  width="36"
                  :height="vBarHeight(sn.yearlyTravelMinutes, maxYearly)"
                  rx="6"
                  :fill="pal(si).hex"
                  opacity="0.85"
                />
                <text
                  :x="vBarX(si, snapshots.length) + 18"
                  :y="vBaselineY + 18"
                  text-anchor="middle"
                  class="fill-slate-200 text-[11px] font-medium"
                >
                  {{ sn.label }}
                </text>
                <text
                  :x="vBarX(si, snapshots.length) + 18"
                  :y="vBaselineY - vBarHeight(sn.yearlyTravelMinutes, maxYearly) - 6"
                  text-anchor="middle"
                  class="fill-slate-100 text-xs font-semibold tabular-nums"
                >
                  {{ Math.round(sn.yearlyTravelMinutes / 60) }}h
                </text>
              </template>
            </svg>
          </div>
          <p class="mt-3 text-center text-xs leading-snug text-slate-400">
            Column height reflects minutes per year; the value above each bar is rounded whole hours.
          </p>
        </section>
      </div>

      <!-- Category color key (for donuts) -->
      <section
        v-if="categories.length"
        class="rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3"
      >
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Colors = trip types</p>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <span
            v-for="cat in categories"
            :key="`key-${cat}`"
            class="inline-flex items-center gap-1.5 text-[11px] text-slate-400"
          >
            <Icon :name="categoryIconName(cat)" class="size-3.5 text-slate-500" aria-hidden="true" />
            <span class="size-2 rounded-sm" :style="{ backgroundColor: CATEGORY_HEX[cat] }" />
            {{ categoryDisplayName(cat) }}
          </span>
        </div>
      </section>

      <!-- Insight -->
      <div
        class="flex flex-col gap-3 rounded-2xl border border-violet-500/20 bg-violet-950/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <div class="flex items-start gap-2 text-sm text-slate-300">
          <Icon name="lucide:compass" class="mt-0.5 size-4 shrink-0 text-violet-400" aria-hidden="true" />
          <p class="min-w-0 leading-relaxed">
            <span class="font-medium text-white">{{ snapshots[bestLifeIndex]?.label }}</span>
            <span class="text-slate-400">
              leads on Life Score ({{ snapshots[bestLifeIndex]?.lifeScore }}/100).
            </span>
            <template v-if="snapshots.length > 1 && bestBurdenIndex !== bestLifeIndex">
              <span class="text-slate-500"> · </span>
              <span class="font-medium text-white">{{ snapshots[bestBurdenIndex]?.label }}</span>
              <span class="text-slate-400"> lightest overall errand load.</span>
            </template>
            <template v-if="snapshots.length > 1 && bestYearlyIndex !== bestLifeIndex">
              <span class="text-slate-500"> · </span>
              <span class="font-medium text-white">{{ snapshots[bestYearlyIndex]?.label }}</span>
              <span class="text-slate-400"> least time on the road per year.</span>
            </template>
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
