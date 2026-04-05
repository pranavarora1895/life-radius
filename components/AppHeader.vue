<script setup lang="ts">
import { lifeRadiusResetKey } from '~/utils/injectionKeys'

const onReset = inject(lifeRadiusResetKey, null)
</script>

<template>
  <header
    class="relative border-b border-cyan-500/20 bg-slate-950/90 shadow-[0_4px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-violet-500/5"
      aria-hidden="true"
    />
    <div class="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
      <div class="min-w-0 flex-1">
        <h1 class="flex items-center gap-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
          <Icon
            name="lucide:map-pin-house"
            class="size-6 shrink-0 text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)] sm:size-7"
            aria-hidden="true"
          />
          Life Radius
        </h1>
        <p
          class="mt-0.5 overflow-x-auto text-xs leading-snug text-slate-400 whitespace-nowrap sm:text-sm sm:leading-normal"
        >
          Plan up to three candidate homes, compare Life Scores side by side: add work and school, and we score trips to
          groceries, gas, pharmacy, gym, and social spots we find nearby.
        </p>
      </div>
      <button
        v-if="onReset"
        type="button"
        class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-500/40 hover:bg-slate-800/90 sm:px-4 sm:text-sm"
        @click="onReset"
      >
        <Icon name="lucide:rotate-ccw" class="size-4 shrink-0 text-cyan-400" aria-hidden="true" />
        Reset all
      </button>
    </div>
  </header>
</template>
