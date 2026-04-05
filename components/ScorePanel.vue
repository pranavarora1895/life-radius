<script setup lang="ts">
import type { AnchorCategory, AnchorRouteResult, AnchorTrafficSummary, ScoreDashboardLeg } from '~/types'
import { categoryIconName } from '~/utils/categoryIcons'
import { GROCERY_ANCHOR_CAP, GROCERY_MAX_DISTANCE_KM } from '~/utils/mapboxApi'
import {
  categoryDisplayName,
  convenienceFromMinutes,
  formatYearlyTravelSummary,
  roleInScore,
  weightedNote,
  yearlyTravelAssumptionNote,
} from '~/utils/scoreExplain'

const yearlyTravelLine = computed(() => {
  const m = scoreResult.value?.yearlyTravelMinutes
  if (m == null) return ''
  return formatYearlyTravelSummary(m)
})

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

const props = withDefaults(
  defineProps<{
    /** Wide layout with prominent score (dashboard). */
    variant?: 'default' | 'focus' | 'dashboard'
    /** Hide “places that support your score” when shown elsewhere (e.g. locations card). */
    hidePlacesSection?: boolean
  }>(),
  { variant: 'default', hidePlacesSection: false },
)

const {
  scoreResult,
  anchors,
  candidateHome,
  travelMode,
  calculating,
  calculateError,
  discoveringPois,
  poiDiscoverError,
} = useLifeRadius()

const isFocus = computed(() => props.variant === 'focus' || props.variant === 'dashboard')
const isDashboard = computed(() => props.variant === 'dashboard')

function anchorFor(id: string) {
  return anchors.value.find((a) => a.id === id)
}

const anchorsForScore = computed(() => {
  const list = anchors.value
  return [...list].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )
})

const trafficByAnchor = computed(() => {
  const out = new Map<string, AnchorTrafficSummary>()
  for (const t of scoreResult.value?.trafficSummaries ?? []) {
    out.set(t.anchorId, t)
  }
  return out
})

function breakdownRows(rows: AnchorRouteResult[]) {
  const tmap = trafficByAnchor.value
  return rows.map((row) => {
    const a = anchorFor(row.anchorId)
    return { row, anchor: a, traffic: tmap.get(row.anchorId) }
  })
}

function delayLine(delaySeconds: number | null): string | null {
  if (delaySeconds == null) return null
  const min = delaySeconds / 60
  if (Math.abs(min) < 0.05) return 'Current time matches typical traffic for this leg.'
  if (min > 0) return `${min.toFixed(1)} min slower than typical traffic.`
  return `${Math.abs(min).toFixed(1)} min faster than typical traffic.`
}

const dashboardLegs = computed((): ScoreDashboardLeg[] => {
  const r = scoreResult.value
  if (!r) return []
  const tmap = trafficByAnchor.value
  return r.rows.map((row) => {
    const a = anchorFor(row.anchorId)
    return {
      anchorId: row.anchorId,
      name: a?.name ?? row.anchorId,
      category: a?.category ?? 'custom',
      minutes: row.durationMinutes,
      weighted: row.weightedImpact,
      error: row.error,
      traffic: tmap.get(row.anchorId) ?? null,
    }
  })
})
</script>

<template>
  <section
    class="dark:bg-zinc-900"
    :class="
      isDashboard
        ? 'border-0 bg-transparent p-0 shadow-none'
        : isFocus
          ? 'mx-auto max-w-3xl rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8 lg:max-w-4xl dark:border-zinc-800'
          : 'rounded-xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800'
    "
  >
    <h2
      v-if="!isDashboard"
      class="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"
      :class="isFocus ? 'text-base sm:text-lg' : 'text-sm'"
    >
      <Icon name="lucide:gauge" class="size-4 shrink-0 text-indigo-600 dark:text-indigo-400 sm:size-5" aria-hidden="true" />
      Life Score
    </h2>
    <p v-if="!isDashboard" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400" :class="isFocus && 'sm:text-sm'">
      We look at travel from your candidate home to work, school (if set), and the groceries, gas, pharmacy, gym, and social spots we found nearby — important places count more than occasional stops.
    </p>

    <template v-if="candidateHome && !hidePlacesSection">
      <h3 class="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Places that support your score
      </h3>
      <p class="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        The map shows many shops and labels from the basemap. Only the stops below (colored pins) are used when you calculate — up to {{ GROCERY_ANCHOR_CAP }} groceries within about {{ GROCERY_MAX_DISTANCE_KM }} km (straight-line), plus a gas station, pharmacy, gym, and social spot we pick for you, plus work and school if you set them.
      </p>

      <p v-if="discoveringPois" class="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        Finding nearby groceries, gas, pharmacy, gym, and social picks…
      </p>
      <div
        v-else-if="poiDiscoverError"
        class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {{ poiDiscoverError }}
      </div>

      <ul
        v-if="anchorsForScore.length"
        class="mt-3 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <li
          v-for="a in anchorsForScore"
          :key="a.id"
          class="flex flex-wrap items-start gap-2 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800"
        >
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
          >
            <Icon :name="categoryIconName(a.category)" class="size-3" aria-hidden="true" />
            {{ categoryDisplayName(a.category) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ a.name }}</p>
            <p
              v-if="a.addressSubtitle"
              class="mt-0.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300"
            >
              {{ a.addressSubtitle }}
            </p>
            <p class="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Importance weight {{ a.weight }} (multiplied by one-way travel minutes in the score)
            </p>
          </div>
        </li>
      </ul>
      <p
        v-else-if="!discoveringPois && !poiDiscoverError"
        class="mt-3 text-xs text-zinc-600 dark:text-zinc-400"
      >
        No scoring stops yet. Add work or school in the panel on the left, or check your connection — we also try to add groceries, a gas station, pharmacy, gym, and social place near your home automatically.
      </p>
    </template>

    <div
      v-if="calculateError && !isDashboard"
      class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {{ calculateError }}
    </div>

    <div v-else-if="calculating" class="mt-6 text-sm text-zinc-600 dark:text-zinc-400">Calculating routes…</div>

    <template v-else-if="scoreResult">
      <TripFrequencyPanel v-if="isDashboard" class="mb-6" />

      <ScoreDashboardVisual
        v-if="isDashboard"
        class="mt-2"
        :life-score="scoreResult.lifeScore"
        :total-burden="scoreResult.totalBurden"
        :yearly-travel-minutes="scoreResult.yearlyTravelMinutes"
        :insight="scoreResult.insight"
        :legs="dashboardLegs"
        :travel-mode="travelMode"
      />

      <template v-if="!isDashboard">
        <div class="mt-6 flex items-baseline gap-2" :class="isFocus && 'mt-8'">
          <span
            class="font-semibold tabular-nums tracking-tight text-indigo-700 dark:text-indigo-300"
            :class="isFocus ? 'text-6xl sm:text-7xl' : 'text-4xl'"
          >
            {{ scoreResult.lifeScore }}
          </span>
          <span class="text-sm text-zinc-500 dark:text-zinc-400" :class="isFocus && 'text-base'">/ 100</span>
        </div>

        <p class="mt-3 leading-relaxed text-zinc-600 dark:text-zinc-400" :class="isFocus ? 'text-base sm:text-lg' : 'text-sm'">
          A higher score means less overall friction: shorter trips to the places below count more when they happen often
          (work, school) or when you chose a high importance weight. Groceries, gas, pharmacy, gym, and social use the specific places and
          venues we found near your candidate home.
        </p>

        <p class="mt-3 font-medium text-zinc-800 dark:text-zinc-100" :class="isFocus ? 'text-base sm:text-lg' : 'text-sm'">
          {{ scoreResult.insight }}
        </p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400" :class="isFocus && 'text-sm'">
          <template v-if="yearlyTravelLine">
            <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ yearlyTravelLine }}</span>
            {{ ' ' }}
            {{ yearlyTravelAssumptionNote() }}
          </template>
          <template v-else> We could not estimate yearly time — check that routes resolved for your stops. </template>
        </p>

        <ScoreDashboardVisual
          class="mt-6"
          compact
          :life-score="scoreResult.lifeScore"
          :total-burden="scoreResult.totalBurden"
          :yearly-travel-minutes="scoreResult.yearlyTravelMinutes"
          :insight="scoreResult.insight"
          :legs="dashboardLegs"
          :travel-mode="travelMode"
        />
      </template>

      <div
        v-if="scoreResult.routeOverlays.length > 0"
        class="rounded-lg p-3"
        :class="
          isDashboard
            ? 'mt-8 border border-cyan-500/20 bg-slate-900/60 backdrop-blur-sm'
            : 'mt-4 border border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/50'
        "
      >
        <h3
          class="text-xs font-semibold uppercase tracking-wide"
          :class="isDashboard ? 'text-slate-500' : 'text-zinc-500 dark:text-zinc-400'"
        >
          Routes &amp; traffic on the map
        </h3>
        <p
          class="mt-2 text-xs leading-relaxed"
          :class="isDashboard ? 'text-slate-400' : 'text-zinc-600 dark:text-zinc-400'"
        >
          Colored lines follow the routes used for the minutes above (home → each stop).
          <template v-if="travelMode === 'driving'">
            Driving uses Mapbox’s traffic-aware routing where data exists, so these minutes reflect congestion along the chosen route.
            With
            <span
              class="font-medium"
              :class="isDashboard ? 'text-cyan-200/90' : 'text-zinc-800 dark:text-zinc-200'"
            >Show traffic on map</span>
            enabled, road colors show wider traffic patterns (updated about every 8 minutes): green (low) through yellow and orange to red (severe).
          </template>
          <template v-else-if="travelMode === 'transit'">
            Each line matches the option we counted for that trip (walking, or bus or train when that won our rules).
            Turn on
            <span
              class="font-medium"
              :class="isDashboard ? 'text-indigo-200/80' : 'text-zinc-800 dark:text-zinc-200'"
            >Show transit on map</span>
            for nearby rail, ferry, and bus context on the basemap.
          </template>
          <template v-else>
            Walking and cycling use non-traffic profiles; the road traffic overlay stays off in those modes so the map stays readable.
          </template>
        </p>
      </div>

      <h3
        class="text-xs font-semibold uppercase tracking-wide"
        :class="isDashboard ? 'mt-8 text-slate-500' : 'mt-6 text-zinc-500 dark:text-zinc-400'"
      >
        {{ isDashboard ? 'About each stop' : 'Why this score — each stop' }}
      </h3>
      <ul class="mt-3 space-y-3">
        <li
          v-for="{ row, anchor, traffic } in breakdownRows(scoreResult.rows)"
          :key="row.anchorId"
          class="rounded-lg border p-3"
          :class="
            isDashboard
              ? 'border-slate-700/80 bg-slate-900/50 backdrop-blur-sm'
              : 'border-zinc-100 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/60'
          "
        >
          <template v-if="anchor">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :class="
                  isDashboard
                    ? 'border border-cyan-500/25 bg-cyan-500/10 text-cyan-200'
                    : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                "
              >
                <Icon :name="categoryIconName(anchor.category)" class="size-3" aria-hidden="true" />
                {{ categoryDisplayName(anchor.category) }}
              </span>
              <span
                v-if="!isDashboard && row.durationMinutes != null && !row.error"
                class="text-xs tabular-nums text-zinc-600 dark:text-zinc-400"
              >
                {{ row.durationMinutes.toFixed(1) }} min one-way
              </span>
              <span
                v-if="!isDashboard && row.weightedImpact != null && !row.error && scoreResult.totalBurden > 0"
                class="text-xs text-zinc-500 dark:text-zinc-500"
              >
                ·
                {{ Math.round((row.weightedImpact / scoreResult.totalBurden) * 100) }}% of score impact
              </span>
            </div>
            <p class="mt-2 text-sm font-medium" :class="isDashboard ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'">
              {{ anchor.name }}
            </p>
            <p
              v-if="anchor.addressSubtitle"
              class="mt-0.5 text-[11px] leading-snug"
              :class="isDashboard ? 'text-slate-400' : 'text-zinc-600 dark:text-zinc-300'"
            >
              {{ anchor.addressSubtitle }}
            </p>
            <p
              class="mt-1 text-xs leading-relaxed"
              :class="isDashboard ? 'text-slate-400' : 'text-zinc-600 dark:text-zinc-400'"
            >
              {{ roleInScore(anchor) }}
            </p>
            <p
              v-if="row.durationMinutes != null && !row.error"
              class="mt-2 text-xs leading-relaxed"
              :class="isDashboard ? 'text-cyan-200/80' : 'text-indigo-800 dark:text-indigo-200/90'"
            >
              {{ convenienceFromMinutes(row.durationMinutes) }}
            </p>
            <p
              v-if="row.weightedImpact != null && !row.error && scoreResult.totalBurden > 0"
              class="mt-1 text-xs leading-relaxed"
              :class="isDashboard ? 'text-slate-500' : 'text-zinc-600 dark:text-zinc-500'"
            >
              {{ weightedNote(row.weightedImpact, scoreResult.totalBurden) }}
            </p>
            <div
              v-if="!row.error && traffic"
              class="mt-2 space-y-0.5 border-t pt-2 text-[11px] leading-relaxed"
              :class="
                isDashboard
                  ? 'border-slate-700/80 text-slate-400'
                  : 'border-zinc-100 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
              "
            >
              <p v-if="traffic.distanceKm != null">
                Route distance ≈ {{ traffic.distanceKm.toFixed(1) }} km (one-way).
              </p>
              <template v-if="travelMode === 'driving'">
                <p v-if="traffic.typicalDurationSeconds != null">
                  Typical time without today’s traffic: ≈
                  {{ (traffic.typicalDurationSeconds / 60).toFixed(1) }} min.
                </p>
                <p v-if="delayLine(traffic.delayVsTypicalSeconds)">
                  {{ delayLine(traffic.delayVsTypicalSeconds) }}
                </p>
                <p v-if="traffic.congestedDurationFraction != null">
                  ≈ {{ Math.round(traffic.congestedDurationFraction * 100) }}% of this leg’s travel time is in moderate,
                  heavy, or severe congestion.
                </p>
              </template>
              <template v-else-if="travelMode === 'transit'">
                <p v-if="traffic.walkCommuteSeconds != null" class="tabular-nums">
                  <span :class="isDashboard ? 'text-slate-500' : 'text-zinc-500'">Walk:</span>
                  {{ (traffic.walkCommuteSeconds / 60).toFixed(1) }} min one-way
                </p>
                <p v-if="traffic.transitCommuteSeconds != null" class="tabular-nums">
                  <span :class="isDashboard ? 'text-slate-500' : 'text-zinc-500'">Public transit (estimate):</span>
                  {{ (traffic.transitCommuteSeconds / 60).toFixed(1) }} min one-way
                </p>
                <p
                  v-else-if="traffic.walkCommuteSeconds != null"
                  :class="isDashboard ? 'text-slate-500' : 'text-zinc-500'"
                >
                  No transit estimate for this trip.
                </p>
                <p v-if="traffic.commuteChoiceNote" :class="isDashboard ? 'text-slate-300' : 'text-zinc-700 dark:text-zinc-300'">
                  {{ traffic.commuteChoiceNote }}
                </p>
                <p v-if="traffic.walkDetourFactor != null">
                  This walk is about
                  <strong
                    class="font-medium"
                    :class="isDashboard ? 'text-cyan-200/90' : 'text-zinc-800 dark:text-zinc-200'"
                  >
                    {{ Math.max(0, Math.round((traffic.walkDetourFactor - 1) * 100)) }}%
                  </strong>
                  longer than a straight line from home — usually extra blocks or turns.
                </p>
                <p
                  v-if="row.durationMinutes != null"
                  class="tabular-nums font-medium"
                  :class="isDashboard ? 'text-cyan-200/90' : 'text-indigo-800 dark:text-indigo-200/90'"
                >
                  <span
                    :class="isDashboard ? 'font-normal text-slate-500' : 'font-normal text-zinc-500 dark:text-zinc-400'"
                  >
                    Counted for score:
                  </span>
                  {{ row.durationMinutes.toFixed(1) }} min
                  <span
                    v-if="traffic.commuteModeUsed === 'transit'"
                    :class="isDashboard ? 'font-normal text-slate-500' : 'font-normal text-zinc-500'"
                  >
                    · transit
                  </span>
                  <span
                    v-else-if="traffic.commuteModeUsed === 'walk'"
                    :class="isDashboard ? 'font-normal text-slate-500' : 'font-normal text-zinc-500'"
                  >
                    · walking
                  </span>
                </p>
              </template>
            </div>
            <p v-if="row.error" class="mt-2 text-xs text-red-600 dark:text-red-400">
              Could not get a route: {{ row.error }}
            </p>
          </template>
          <template v-else>
            <p class="text-xs text-zinc-500">{{ row.anchorId }}</p>
            <p v-if="row.error" class="mt-1 text-xs text-red-600">{{ row.error }}</p>
          </template>
        </li>
      </ul>

    </template>

    <p v-else class="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
      Set a candidate home on the map, then choose travel mode and tap Calculate.
    </p>
  </section>
</template>
