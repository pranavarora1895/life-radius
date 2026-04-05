<script setup lang="ts">
const config = useRuntimeConfig()

const {
  anchors,
  candidateHome,
  travelMode,
  showTrafficLayer,
  showTransitLayer,
  setTravelMode,
  setShowTrafficLayer,
  setShowTransitLayer,
  calculateScore,
  calculating,
  calculateError,
  resetAll,
} = useLifeRadius()

const token = computed(() => (config.public.mapboxAccessToken as string) || '')

/** When set, Transit scoring can compare walk vs public transit times. */
const walkTransitComparisonAvailable = computed(() =>
  Boolean(String(config.public.googleMapsApiKey ?? '').trim()),
)

const canCalculate = computed(
  () => Boolean(candidateHome.value && anchors.value.length && token.value && !calculating.value),
)

const travelModeIcon = {
  driving: 'lucide:car',
  walking: 'lucide:footprints',
  cycling: 'lucide:bike',
  transit: 'lucide:train-front',
} as const

const travelModes = ['driving', 'walking', 'cycling', 'transit'] as const

function onTrafficLayerChange(e: Event) {
  setShowTrafficLayer((e.target as HTMLInputElement).checked)
}

function onTransitLayerChange(e: Event) {
  setShowTransitLayer((e.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <LocationSetup />
    <section
      class="rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-4 shadow-[0_0_32px_rgba(34,211,238,0.06)] backdrop-blur-xl"
    >
      <h2 class="text-sm font-semibold text-white">Travel mode</h2>
      <div class="mt-2.5 flex flex-wrap gap-2">
        <button
          v-for="mode in travelModes"
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
          @change="onTrafficLayerChange"
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
          <span class="mt-0.5 block text-[11px] leading-snug text-slate-200">
            Typical congestion on major roads, refreshed about every eight minutes. Easiest to read while planning drives;
            your route lines still show for whichever travel mode you chose.
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
          @change="onTransitLayerChange"
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
          <span class="mt-0.5 block text-[11px] leading-snug text-slate-200">
            <template v-if="walkTransitComparisonAvailable">
              Adds rail, ferries, bus-only lanes, and stop markers. For Transit scoring, we can compare walking with
              public transit when both estimates are available.
            </template>
            <template v-else>
              Adds rail, ferries, bus-only lanes, and stop markers. Walk-versus-transit timing for Transit scoring isn’t
              available here yet—your score still follows the travel mode you picked.
            </template>
            Map layers only change what you see—they don’t switch the travel mode used for your Life Score.
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
      <p class="mt-2 text-[11px] leading-snug text-slate-300">
        Reset clears every plan and leaves one empty workspace. Use + to plan up to three homes; Compare opens when at
        least two have a Life Score.
      </p>
    </section>
  </div>
</template>
