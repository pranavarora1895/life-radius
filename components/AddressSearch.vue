<script setup lang="ts">
import { forwardGeocode } from '~/utils/mapboxApi'
import type { LngLat } from '~/types'

const props = withDefaults(
  defineProps<{
    label: string
    placeholder?: string
    /** When set, shows a clear control (optional fields). */
    selectedLabel?: string | null
    optional?: boolean
    proximity?: LngLat | null
  }>(),
  { placeholder: 'Search address or place', optional: false, selectedLabel: null, proximity: null },
)

const emit = defineEmits<{
  select: [payload: { lngLat: LngLat; label: string }]
  clear: []
}>()

const config = useRuntimeConfig()
const query = ref('')
const suggestions = ref<{ id: string; place_name: string; center: [number, number] }[]>([])
const geocodeError = ref<string | null>(null)

const hasToken = computed(() => Boolean(config.public.mapboxAccessToken))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  geocodeError.value = null
  const text = q.trim()
  if (text.length < 2) {
    suggestions.value = []
    return
  }
  if (!hasToken.value) {
    suggestions.value = []
    return
  }
  debounceTimer = setTimeout(async () => {
    try {
      const base = (config.public.mapboxApiBase as string) || 'https://api.mapbox.com'
      const token = config.public.mapboxAccessToken as string | undefined
      const proximity = props.proximity ? ([props.proximity.lng, props.proximity.lat] as [number, number]) : undefined
      const feats = await forwardGeocode(text, base, token, { limit: 6, proximity })
      suggestions.value = feats.map((f) => ({
        id: f.id,
        place_name: f.place_name,
        center: f.center,
      }))
    } catch (e) {
      geocodeError.value = e instanceof Error ? e.message : 'Search failed'
      suggestions.value = []
    }
  }, 320)
})

function pick(s: { place_name: string; center: [number, number] }) {
  query.value = ''
  suggestions.value = []
  emit('select', {
    label: s.place_name,
    lngLat: { lng: s.center[0], lat: s.center[1] },
  })
}

function clearField() {
  query.value = ''
  suggestions.value = []
  geocodeError.value = null
  emit('clear')
}
</script>

<template>
  <div class="relative space-y-1.5">
    <div class="flex items-center justify-between gap-2">
      <label class="text-xs font-medium text-slate-300">{{ label }}</label>
      <span v-if="optional" class="text-[10px] uppercase tracking-wide text-slate-500">Optional</span>
    </div>
    <div class="relative">
      <div class="flex gap-2">
        <div class="relative min-w-0 flex-1">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            v-model="query"
            type="text"
            :disabled="!hasToken"
            class="w-full rounded-lg border border-slate-600 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            :placeholder="placeholder"
            autocomplete="off"
          >
        </div>
        <button
          v-if="optional && selectedLabel"
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800/80"
          @click="clearField"
        >
          <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
      <ul
        v-if="suggestions.length"
        class="absolute left-0 right-0 top-full z-30 mt-1 max-h-44 overflow-auto rounded-lg border border-slate-600 bg-slate-900 py-1 text-sm shadow-xl shadow-black/40"
      >
        <li
          v-for="s in suggestions"
          :key="s.id"
          class="cursor-pointer px-3 py-2 text-slate-200 hover:bg-cyan-500/15 hover:text-cyan-100"
          @mousedown.prevent="pick(s)"
        >
          {{ s.place_name }}
        </li>
      </ul>
    </div>
    <p v-if="!hasToken" class="text-xs text-amber-400/90">Mapbox token required for search.</p>
    <p v-else-if="geocodeError" class="text-xs text-red-400">{{ geocodeError }}</p>
  </div>
</template>
