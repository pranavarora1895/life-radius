<script setup lang="ts">
import type { GroceryCompareLeg } from '~/types'
import { grocerySunburstInnerPath, grocerySunburstOuterPaths } from '~/utils/compareCharts'

const props = withDefaults(
  defineProps<{
    legs: GroceryCompareLeg[]
    /** Tighter spacing when nested inside another card (e.g. Life score dashboard). */
    embed?: boolean
  }>(),
  { embed: false },
)

const box = 156
const cx = box / 2
const cy = box / 2
const rInner = 18
const rMid = 44
const rOuter = 72

const innerD = computed(() => grocerySunburstInnerPath(cx, cy, rInner, rMid))

const outerPaths = computed(() =>
  props.legs.length ? grocerySunburstOuterPaths(props.legs, cx, cy, rMid, rOuter) : [],
)
</script>

<template>
  <div
    v-if="legs.length > 1"
    class="w-full rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-slate-950/40 px-3 py-4 sm:px-4"
    :class="embed ? 'mt-0' : 'mt-4'"
  >
    <p class="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
      <Icon name="lucide:circle-dot" class="size-3.5 text-emerald-400" aria-hidden="true" />
      Grocery sunburst
    </p>
    <p class="mb-3 text-[11px] leading-relaxed text-slate-500">
      <span class="text-emerald-200/80">Inner ring</span> — all grocery stops combined (same as the donut’s grocery slice).
      <span class="text-slate-600">·</span>
      <span class="text-emerald-200/80">Outer ring</span> — each store’s piece of that combined slice (up to four stops are scored separately).
    </p>
    <div class="flex flex-col items-stretch gap-4">
      <svg
        class="mx-auto shrink-0 drop-shadow-[0_0_20px_rgba(16,185,129,0.15)]"
        :width="box"
        :height="box"
        :viewBox="`0 0 ${box} ${box}`"
        role="img"
        aria-label="Sunburst of grocery burden by store"
      >
        <path
          :d="innerD"
          fill="#34d399"
          fill-opacity="0.22"
          stroke="rgb(15 23 42)"
          stroke-width="1"
        />
        <path
          v-for="p in outerPaths"
          :key="p.leg.anchorId"
          :d="p.d"
          :fill="p.color"
          stroke="rgb(15 23 42)"
          stroke-width="1"
          opacity="0.95"
        />
        <text
          :x="cx"
          :y="cy - 2"
          text-anchor="middle"
          class="fill-emerald-100/90 text-[11px] font-bold tabular-nums"
        >
          {{ legs.length }}
        </text>
        <text
          :x="cx"
          :y="cy + 10"
          text-anchor="middle"
          class="fill-slate-500 text-[8px] font-medium uppercase tracking-wide"
        >
          stops
        </text>
      </svg>
      <ul class="grid w-full min-w-0 gap-2 text-[11px] sm:grid-cols-2">
        <li
          v-for="p in outerPaths"
          :key="p.leg.anchorId"
          class="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5"
        >
          <div class="flex items-start gap-2">
            <span
              class="mt-0.5 size-2.5 shrink-0 rounded-sm ring-1 ring-slate-700"
              :style="{ backgroundColor: p.color }"
            />
            <span class="min-w-0 flex-1 font-medium leading-snug text-slate-200 break-words">{{ p.leg.name }}</span>
          </div>
          <div class="mt-2 space-y-1 border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
            <p>
              <span class="text-slate-600">Of groceries</span>
              <span class="ml-1 tabular-nums font-medium text-slate-300">{{ p.leg.pctOfGrocery.toFixed(1) }}%</span>
            </p>
            <p>
              <span class="text-slate-600">Of total burden</span>
              <span class="ml-1 tabular-nums font-medium text-emerald-200/90">{{ p.leg.pctOfTotalBurden.toFixed(1) }}%</span>
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
  <p
    v-else-if="legs.length === 1"
    class="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-[11px] leading-relaxed text-slate-500"
    :class="embed ? 'mt-0' : 'mt-3'"
  >
    <span class="font-medium text-slate-400">One grocery stop</span>
    is scored for this home. The donut’s grocery slice is that single leg; when several nearby stores are included (up to
    four), a sunburst appears to split the slice fairly.
  </p>
</template>
