<script setup lang="ts">
import type { LifeScenario } from '~/types'
import { lifeRadiusResetKey } from '~/utils/injectionKeys'
import { snapshotsFromScenarios } from '~/utils/scenarioCompare'

const config = useRuntimeConfig()

const {
  maxScenarios,
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
  showTrafficLayer,
  showTransitLayer,
  setCandidateHome,
  setWorkPlace,
  setSchoolPlace,
  setTravelMode,
  setShowTrafficLayer,
  setShowTransitLayer,
  calculateScore,
  resetAll,
} = useLifeRadius()

const homeMapSummary = computed(() => {
  if (!candidateHome.value) return ''
  return (
    candidateHomeAddress.value?.trim() ||
    candidateHomeLabel.value?.trim() ||
    `${candidateHome.value.lat.toFixed(4)}, ${candidateHome.value.lng.toFixed(4)}`
  )
})

const mapPlacedSlots = computed(() => ({
  home: candidateHome.value != null,
  work: workPlace.value != null,
  school: schoolPlace.value != null,
}))

function onMapPlacePick(payload: { kind: 'home' | 'work' | 'school'; lngLat: { lng: number; lat: number } }) {
  const label = payload.kind === 'home' ? 'Home' : payload.kind === 'work' ? 'Work' : 'School'
  if (payload.kind === 'home') setCandidateHome(payload.lngLat, label)
  else if (payload.kind === 'work') setWorkPlace({ lngLat: payload.lngLat, label })
  else setSchoolPlace({ lngLat: payload.lngLat, label })
}

const token = computed(() => (config.public.mapboxAccessToken as string) || '')
const hasGoogleMapsKey = computed(() => Boolean(String(config.public.googleMapsApiKey ?? '').trim()))

const canCalculate = computed(
  () => Boolean(candidateHome.value && anchors.value.length && token.value && !calculating.value),
)

const travelModeIcon = {
  driving: 'lucide:car',
  walking: 'lucide:footprints',
  cycling: 'lucide:bike',
  transit: 'lucide:train-front',
} as const

type MainTab = 'plan' | 'results' | 'compare'

const activeTab = ref<MainTab>('plan')

const showResultsTab = computed(() => scoreResult.value != null || calculating.value)

const showCompareTab = computed(() => scoredScenarioCount.value >= 2)

const compareSnapshots = computed(() => snapshotsFromScenarios(scenarios.value))

const activeScenarioLabel = computed(
  () => scenarios.value.find((s) => s.id === activeScenarioId.value)?.label ?? '',
)

function onActiveLabelInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  setScenarioLabel(activeScenarioId.value, v)
}

function onAddScenario() {
  if (addScenario()) activeTab.value = 'plan'
}

function confirmRemoveScenario(s: LifeScenario) {
  const hasData = s.candidateHome != null || s.scoreResult != null || s.workPlace != null || s.schoolPlace != null
  if (hasData && !confirm(`Remove "${s.label}"? This cannot be undone.`)) return
  removeScenario(s.id)
}

const topRowHeightClass = 'min-h-[280px] h-[min(42vh,400px)] lg:h-[min(50vh,520px)]'

watch(calculating, (on) => {
  if (on) activeTab.value = 'results'
})

watch(scoreResult, (v) => {
  if (v) activeTab.value = 'results'
})

watch(showResultsTab, (on) => {
  if (!on && activeTab.value === 'results') activeTab.value = 'plan'
})

watch(showCompareTab, (on) => {
  if (!on && activeTab.value === 'compare') {
    activeTab.value = showResultsTab.value ? 'results' : 'plan'
  }
})

function resetAndGoPlan() {
  resetAll()
  activeTab.value = 'plan'
}

provide(lifeRadiusResetKey, resetAndGoPlan)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-950 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]">
    <AppHeader />
    <main class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex shrink-0 flex-col gap-2 border-b border-slate-800/90 bg-slate-900/90 px-4 py-2 backdrop-blur-xl lg:px-6"
      >
        <div class="flex flex-wrap items-center gap-1" role="tablist" aria-label="Main sections">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'plan'"
            class="rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              activeTab === 'plan'
                ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            "
            @click="activeTab = 'plan'"
          >
            Plan &amp; map
          </button>
          <button
            v-if="showResultsTab"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'results'"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              activeTab === 'results'
                ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            "
            @click="activeTab = 'results'"
          >
            Life score
            <span
              v-if="scoreResult && !calculating"
              class="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-xs tabular-nums text-cyan-200"
            >
              {{ scoreResult.lifeScore }}
            </span>
            <Icon
              v-else-if="calculating"
              name="lucide:loader-circle"
              class="size-3.5 animate-spin text-cyan-400"
              aria-hidden="true"
            />
          </button>
          <button
            v-if="scenarios.length < maxScenarios"
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-lg border border-dashed border-slate-600 text-slate-400 transition hover:border-cyan-500/50 hover:bg-slate-800/80 hover:text-cyan-200"
            title="Add another scenario (up to three)"
            aria-label="Add scenario"
            @click="onAddScenario"
          >
            <Icon name="lucide:plus" class="size-5" aria-hidden="true" />
          </button>
          <button
            v-if="showCompareTab"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'compare'"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              activeTab === 'compare'
                ? 'bg-violet-500/20 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/40'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            "
            @click="activeTab = 'compare'"
          >
            <Icon name="lucide:git-compare" class="size-4 shrink-0" aria-hidden="true" />
            Compare
            <span
              class="rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-xs tabular-nums text-violet-200"
            >
              {{ scoredScenarioCount }}
            </span>
          </button>
        </div>

        <div
          v-if="scenarios.length"
          class="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-2"
          role="group"
          aria-label="Active scenario"
        >
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Scenarios</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <div
              v-for="s in scenarios"
              :key="s.id"
              class="inline-flex items-center gap-0.5 rounded-lg border border-slate-700/90 bg-slate-950/50 p-0.5"
            >
              <button
                type="button"
                class="inline-flex max-w-[10rem] items-center gap-1.5 rounded-md px-2.5 py-1 text-left text-xs font-medium transition"
                :class="
                  activeScenarioId === s.id
                    ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-500/35'
                    : 'text-slate-400 hover:bg-slate-800/90 hover:text-slate-200'
                "
                @click="setActiveScenario(s.id)"
              >
                <span class="truncate">{{ s.label }}</span>
                <span
                  v-if="s.scoreResult"
                  class="shrink-0 rounded border border-slate-600/80 bg-slate-900/80 px-1 py-0.5 tabular-nums text-[10px] text-slate-300"
                >
                  {{ s.scoreResult.lifeScore }}
                </span>
                <Icon
                  v-else-if="s.calculating"
                  name="lucide:loader-circle"
                  class="size-3 shrink-0 animate-spin text-cyan-400"
                  aria-hidden="true"
                />
              </button>
              <button
                v-if="scenarios.length > 1"
                type="button"
                class="rounded-md p-1 text-slate-500 hover:bg-rose-950/50 hover:text-rose-300"
                :aria-label="`Remove ${s.label}`"
                @click="confirmRemoveScenario(s)"
              >
                <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <label class="ml-auto flex min-w-0 max-w-full flex-1 items-center gap-2 sm:max-w-xs">
            <span class="shrink-0 text-[11px] text-slate-500">Name</span>
            <input
              :value="activeScenarioLabel"
              type="text"
              class="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              placeholder="Scenario label"
              maxlength="48"
              @input="onActiveLabelInput"
            />
          </label>
        </div>
      </div>

      <!-- Plan & map: setup + map (default workspace). v-if so only one MapView exists at a time. -->
      <div
        v-if="activeTab === 'plan'"
        class="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-stretch lg:gap-5 lg:p-6"
      >
        <aside class="flex w-full shrink-0 flex-col gap-3 lg:max-w-[20rem]">
          <LocationSetup />
          <section
            class="rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-4 shadow-[0_0_32px_rgba(34,211,238,0.06)] backdrop-blur-xl"
          >
            <h2 class="text-sm font-semibold text-white">Travel mode</h2>
            <div class="mt-2.5 flex flex-wrap gap-2">
              <button
                v-for="mode in (['driving', 'walking', 'cycling', 'transit'] as const)"
                :key="mode"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition"
                :class="
                  travelMode === mode
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.2)]'
                    : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80'
                "
                @click="setTravelMode(mode)"
              >
                <Icon :name="travelModeIcon[mode]" class="size-3.5 shrink-0" aria-hidden="true" />
                {{ mode }}
              </button>
            </div>
            <label
              class="mt-2.5 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-xs text-slate-300"
            >
              <input
                type="checkbox"
                class="mt-0.5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0"
                :checked="showTrafficLayer"
                @change="setShowTrafficLayer(($event.target as HTMLInputElement).checked)"
              />
              <span>
                <span class="inline-flex items-center gap-1.5 font-medium text-white">
                  <Icon
                    name="lucide:traffic-cone"
                    class="size-3.5 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                  Show traffic on map
                </span>
                <span class="mt-0.5 block text-[11px] leading-snug text-slate-500">
                  Road congestion colors (Mapbox Traffic, ~8 min updates). Most useful in driving mode; routes still
                  draw for walk/bike/transit.
                </span>
              </span>
            </label>
            <label
              class="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-xs text-slate-300"
            >
              <input
                type="checkbox"
                class="mt-0.5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0"
                :checked="showTransitLayer"
                @change="setShowTransitLayer(($event.target as HTMLInputElement).checked)"
              />
              <span>
                <span class="inline-flex items-center gap-1.5 font-medium text-white">
                  <Icon
                    name="lucide:train-front"
                    class="size-3.5 shrink-0 text-indigo-400"
                    aria-hidden="true"
                  />
                  Show transit on map
                </span>
                <span class="mt-0.5 block text-[11px] leading-snug text-slate-500">
                  <template v-if="hasGoogleMapsKey">
                    Map lines are all Mapbox (same look as the rest of the app). Your optional key is only used on the
                    server in Transit mode to compare walking with public transit — not a second map layer.
                  </template>
                  <template v-else>
                    OSM via Mapbox: rail, ferry, dedicated bus lanes, and bus stop dots. Add the optional key from
                    <code class="rounded bg-slate-800 px-0.5 font-mono text-[10px] text-cyan-200/80">.env.example</code>
                    if you want walk-vs-transit times in Transit mode (server-side only).
                  </template>
                  Independent of travel mode used for scoring.
                </span>
              </span>
            </label>
            <button
              type="button"
              class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:from-cyan-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canCalculate"
              @click="calculateScore"
            >
              <Icon
                :name="calculating ? 'lucide:loader-circle' : 'lucide:calculator'"
                class="size-4 shrink-0"
                :class="calculating ? 'animate-spin' : ''"
                aria-hidden="true"
              />
              {{ calculating ? 'Calculating…' : 'Calculate Life Score' }}
            </button>
            <div
              v-if="calculateError"
              class="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
            >
              {{ calculateError }}
            </div>
            <button
              type="button"
              class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-950/40 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80"
              @click="resetAll"
            >
              <Icon name="lucide:rotate-ccw" class="size-4 shrink-0" aria-hidden="true" />
              Reset all
            </button>
            <p class="mt-2 text-[11px] leading-snug text-slate-500">
              Reset clears every scenario and leaves one empty workspace. Use + to plan up to three homes; Compare opens when at least two have a Life Score.
            </p>
          </section>
        </aside>

        <div
          class="flex min-h-[320px] w-full flex-1 flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/40 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-sm lg:min-h-[min(70vh,560px)]"
        >
          <div class="relative min-h-0 flex-1 bg-slate-950/80">
            <MapView
              :anchors="anchors"
              :candidate-home="candidateHome"
              :home-marker-hint="homeMapSummary"
              :mapbox-token="token"
              :travel-mode="travelMode"
              :route-overlays="scoreResult?.routeOverlays ?? []"
              :show-traffic-layer="showTrafficLayer"
              :show-transit-layer="showTransitLayer"
              :placed-slots="mapPlacedSlots"
              @place-pick="onMapPlacePick"
            />
          </div>
          <p
            v-if="candidateHome"
            class="shrink-0 border-t border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-400"
          >
            Home: {{ homeMapSummary }}
          </p>
        </div>
      </div>

      <!-- Life score: two cards on top, dashboard below (only this tab) -->
      <div
        v-else-if="activeTab === 'results'"
        class="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8 lg:gap-5 lg:p-6"
      >
        <div class="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 lg:items-stretch">
          <article
            class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/90 shadow-[0_0_36px_rgba(34,211,238,0.06)] backdrop-blur-sm"
            :class="topRowHeightClass"
          >
            <div
              class="flex shrink-0 items-center gap-2 border-b border-slate-800/90 bg-slate-900/80 px-4 py-3"
            >
              <Icon
                name="lucide:map"
                class="size-4 shrink-0 text-cyan-400"
                aria-hidden="true"
              />
              <h2 class="text-sm font-semibold text-white">Map</h2>
              <span class="text-xs text-slate-500">View only · routes &amp; pins</span>
            </div>
            <div class="relative min-h-0 flex-1 bg-slate-950/80">
              <MapView
                read-only
                :anchors="anchors"
                :candidate-home="candidateHome"
                :home-marker-hint="homeMapSummary"
                :mapbox-token="token"
                :travel-mode="travelMode"
                :route-overlays="scoreResult?.routeOverlays ?? []"
                :show-traffic-layer="showTrafficLayer"
                :show-transit-layer="showTransitLayer"
                :placed-slots="mapPlacedSlots"
              />
            </div>
            <p
              v-if="candidateHome"
              class="shrink-0 border-t border-slate-800 bg-slate-900/90 px-4 py-2 text-[11px] text-slate-400"
            >
              Home: {{ homeMapSummary }}
            </p>
          </article>

          <article
            class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-950/90 shadow-[0_0_36px_rgba(139,92,246,0.08)] backdrop-blur-sm"
            :class="topRowHeightClass"
          >
            <div class="shrink-0 border-b border-slate-800/90 bg-slate-900/80 px-4 py-3">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon
                  name="lucide:layers"
                  class="size-4 shrink-0 text-violet-400"
                  aria-hidden="true"
                />
                Locations &amp; amenities
              </h2>
              <p class="mt-1 text-xs leading-relaxed text-slate-400">
                Snapshot of the active scenario (edit on Plan &amp; map). Switch scenarios in the bar above.
              </p>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-950/50 p-4">
              <LocationSetup embedded readonly />
            </div>
          </article>
        </div>

        <section
          class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.06)] backdrop-blur-sm"
        >
          <div
            class="shrink-0 border-b border-slate-800/90 bg-slate-900/80 px-4 py-4 sm:px-5 sm:py-5"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div class="min-w-0">
                <h2
                  class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-white"
                >
                  <Icon
                    name="lucide:layout-dashboard"
                    class="size-5 shrink-0 text-cyan-400"
                    aria-hidden="true"
                  />
                  Life score dashboard
                  <span
                    v-if="scoreResult && !calculating"
                    class="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-base tabular-nums text-cyan-200"
                  >
                    {{ scoreResult.lifeScore }}
                    <span class="text-xs font-normal text-cyan-400/80">/ 100</span>
                  </span>
                  <Icon
                    v-else-if="calculating"
                    name="lucide:loader-circle"
                    class="size-5 animate-spin text-cyan-400"
                    aria-hidden="true"
                  />
                </h2>
                <p class="mt-1 max-w-2xl text-xs text-slate-400 sm:text-sm">
                  Map and locations are view-only here. Adjust round trips per week under the dashboard to tune yearly
                  hours and how heavily each leg affects the Life Score. Switch travel mode and recalculate to refresh
                  route times and traffic, or use
                  <span class="font-medium text-cyan-200/90">Reset all</span> in the header to clear every scenario.
                </p>
                <p class="mt-2 text-xs text-slate-500">
                  <span class="font-medium text-slate-400">Map overlays — traffic:</span>
                  {{ showTrafficLayer ? 'on' : 'off' }}
                  <span class="text-slate-600">·</span>
                  <span class="font-medium text-slate-400">transit:</span>
                  {{ showTransitLayer ? 'on' : 'off' }}
                  <span class="text-slate-600">(Plan &amp; map)</span>
                </p>
              </div>

              <div class="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-col lg:items-stretch">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="mode in (['driving', 'walking', 'cycling', 'transit'] as const)"
                    :key="mode"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition"
                    :class="
                      travelMode === mode
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.2)]'
                        : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80'
                    "
                    :disabled="calculating"
                    @click="setTravelMode(mode)"
                  >
                    <Icon :name="travelModeIcon[mode]" class="size-3.5 shrink-0" aria-hidden="true" />
                    {{ mode }}
                  </button>
                </div>
                <button
                  type="button"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:from-cyan-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  :disabled="!canCalculate"
                  @click="calculateScore"
                >
                  <Icon
                    :name="calculating ? 'lucide:loader-circle' : 'lucide:calculator'"
                    class="size-4 shrink-0"
                    :class="calculating ? 'animate-spin' : ''"
                    aria-hidden="true"
                  />
                  {{ calculating ? 'Calculating…' : 'Recalculate' }}
                </button>
                <div
                  v-if="calculateError"
                  class="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
                >
                  {{ calculateError }}
                </div>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 bg-slate-950 px-4 py-5 sm:px-6 sm:py-6">
            <ScorePanel variant="dashboard" hide-places-section />
          </div>
        </section>
      </div>

      <!-- Compare: all scored scenarios -->
      <div
        v-else-if="activeTab === 'compare'"
        class="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8 lg:gap-5 lg:p-6"
      >
        <section
          class="rounded-2xl border border-violet-500/25 bg-slate-950/90 p-5 shadow-[0_0_40px_rgba(139,92,246,0.08)] backdrop-blur-sm sm:p-6"
        >
          <h2 class="flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
            <Icon name="lucide:git-compare" class="size-5 shrink-0 text-violet-400" aria-hidden="true" />
            Compare homes
          </h2>
          <p class="mt-1 max-w-none text-sm text-slate-400">
            Life Score, travel time, and errand load for homes you’ve already scored, side by side.
          </p>
          <div class="mt-6">
            <ScenarioComparePanel :snapshots="compareSnapshots" />
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
