<script setup lang="ts">
import type { Anchor, AnchorCategory, AnchorRouteResult } from '~/types'
import { categoryIconName } from '~/utils/categoryIcons'
import { categoryDisplayName } from '~/utils/scoreExplain'
import { defaultRoundTripsPerWeek } from '~/utils/scoring'

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

const { anchors, scoreResult, setAnchorRoundTripsPerWeek } = useLifeRadius()

const rowByAnchor = computed(() => {
  const m = new Map<string, AnchorRouteResult>()
  for (const row of scoreResult.value?.rows ?? []) {
    m.set(row.anchorId, row)
  }
  return m
})

const sortedAnchors = computed(() => {
  const list = anchors.value
  return [...list].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )
})

function hasRoute(a: Anchor): boolean {
  const row = rowByAnchor.value.get(a.id)
  return Boolean(row && !row.error && row.durationMinutes != null)
}

function displayValue(a: Anchor): string {
  const v = a.roundTripsPerWeek
  if (v == null) return ''
  return String(v)
}

function onTripsInput(a: Anchor, raw: string) {
  const t = raw.trim()
  if (t === '') {
    setAnchorRoundTripsPerWeek(a.id, null)
    return
  }
  const n = Number.parseFloat(t.replace(',', '.'))
  if (Number.isNaN(n)) return
  setAnchorRoundTripsPerWeek(a.id, n)
}

function defLabel(cat: AnchorCategory): string {
  const d = defaultRoundTripsPerWeek(cat)
  const rounded = Math.abs(d - Math.round(d)) < 0.01 ? String(Math.round(d)) : d.toFixed(2).replace(/\.?0+$/, '')
  return `default ${rounded}/wk`
}
</script>

<template>
  <details
    class="group rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-4 shadow-[0_0_28px_rgba(34,211,238,0.06)] backdrop-blur-xl open:shadow-[0_0_28px_rgba(34,211,238,0.1)] sm:p-5"
  >
    <summary
      class="flex cursor-pointer list-none items-start gap-2 rounded-lg text-left outline-none ring-cyan-500/40 transition hover:bg-slate-800/40 focus-visible:ring-2 [&::-webkit-details-marker]:hidden"
    >
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15"
        aria-hidden="true"
      >
        <Icon name="lucide:calendar-clock" class="size-4 text-cyan-400" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-white">Yearly time — your trip frequency</h3>
        <p class="mt-0.5 text-[11px] text-slate-500 group-open:hidden">
          Tap to set round trips per week for each stop.
        </p>
      </div>
      <Icon
        name="lucide:chevron-down"
        class="mt-1 size-5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-0 -rotate-90"
        aria-hidden="true"
      />
    </summary>

    <div class="mt-3 border-t border-slate-700/60 pt-3">
      <p class="text-xs leading-relaxed text-slate-400">
        Round trips per week — leave blank for the default for that place type. Both the yearly hours estimate and the
        Life Score update immediately (we scale how much each leg matters vs the default trip rate).         Recalculate to
        refresh route times and overlays (traffic, transit). Multiple grocery stops share one yearly-time estimate (shortest route);
        their weekly rates are averaged there; each store still affects the score separately by distance and importance.
      </p>

      <ul class="mt-4 space-y-3" role="list">
        <li
          v-for="a in sortedAnchors"
          :key="a.id"
          class="flex flex-col gap-2 rounded-xl border border-slate-700/70 bg-slate-950/50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <div class="flex min-w-0 flex-1 items-start gap-2">
            <Icon
              :name="categoryIconName(a.category)"
              class="mt-0.5 size-4 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="text-xs font-medium text-slate-200">{{ a.name }}</p>
              <p class="text-[11px] text-slate-500">
                {{ categoryDisplayName(a.category) }}
                <span v-if="!hasRoute(a)" class="text-amber-500/90"> · no route yet</span>
              </p>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <label class="flex items-center gap-2 text-[11px] text-slate-400">
              <span class="whitespace-nowrap">Rounds / week</span>
              <input
                type="number"
                min="0"
                max="42"
                step="0.25"
                :value="displayValue(a)"
                :placeholder="defaultRoundTripsPerWeek(a.category).toFixed(2)"
                class="w-[5.5rem] rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs tabular-nums text-white placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                :aria-label="`Round trips per week for ${a.name}`"
                @click.stop
                @input="onTripsInput(a, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <span class="text-[10px] text-slate-600">{{ defLabel(a.category) }}</span>
          </div>
        </li>
      </ul>
    </div>
  </details>
</template>
