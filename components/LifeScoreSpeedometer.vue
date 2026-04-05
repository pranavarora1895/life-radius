<script setup lang="ts">
/**
 * Car-style speedometer: upper semicircle 0–100, colored zones, tick marks, needle, hub.
 * Angle map: 0 score = west (π), 100 score = east (2π), sweep through north (3π/2).
 */
const props = withDefaults(
  defineProps<{
    score: number
    accentHex: string
    /** Used for accessibility; when embedded, not shown under the dial. */
    label: string
    /** Hide label + score readout below SVG (e.g. inside At a glance cards). */
    embedded?: boolean
  }>(),
  { embedded: false },
)

const uid = useId()

const W = 132
const H = 108
const cx = W / 2
const cy = H - 10
const R = 50
const rNeedle = 42

function ang(score: number) {
  const s = Math.min(100, Math.max(0, score))
  return Math.PI + (Math.PI * s) / 100
}

function pt(radius: number, score: number) {
  const a = ang(score)
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
}

/** Arc along outer radius from score s0 to s1 (sweep increasing score = clockwise along upper semicircle). */
function arcPath(radius: number, s0: number, s1: number): string {
  const p0 = pt(radius, s0)
  const p1 = pt(radius, s1)
  const da = ang(s1) - ang(s0)
  const largeArc = Math.abs(da) > Math.PI ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`
}

const trackOuter = R + 6
const trackInner = R - 2

/** Thick track (donut segment) approximated by stroked arc - use double line or filled band via path */
const zoneBands = [
  { from: 0, to: 40, color: 'rgba(248,113,113,0.45)' },
  { from: 40, to: 55, color: 'rgba(251,191,36,0.4)' },
  { from: 55, to: 75, color: 'rgba(74,222,128,0.4)' },
  { from: 75, to: 100, color: 'rgba(34,211,238,0.35)' },
] as const

const tickScores = [0, 25, 50, 75, 100]

const needleEnd = computed(() => pt(rNeedle, props.score))

const hubR = 6
</script>

<template>
  <div class="flex flex-col items-center">
    <svg
      :width="W"
      :height="H"
      :viewBox="`0 0 ${W} ${H}`"
      class="overflow-visible"
      role="img"
      :aria-label="`Life score speedometer ${Math.round(score)} of 100 for ${label}`"
    >
      <defs>
        <filter :id="`ls-spd-glow-${uid}`" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Outer bezel -->
      <path
        :d="arcPath(trackOuter + 2, 0, 100)"
        fill="none"
        stroke="rgb(30 41 59)"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.9"
      />

      <!-- Colored zones (thick strokes along arc) -->
      <path
        v-for="(z, zi) in zoneBands"
        :key="zi"
        :d="arcPath(R + 2, z.from, z.to)"
        fill="none"
        :stroke="z.color"
        stroke-width="10"
        stroke-linecap="butt"
      />

      <!-- Inner dark arc (inner edge of dial) -->
      <path
        :d="arcPath(R - 6, 0, 100)"
        fill="none"
        stroke="rgb(15 23 42 / 0.85)"
        stroke-width="2"
      />

      <!-- Tick marks -->
      <g v-for="t in tickScores" :key="t">
        <line
          :x1="pt(R + 1, t).x"
          :y1="pt(R + 1, t).y"
          :x2="pt(R - (t % 50 === 0 && t !== 0 ? 10 : 6), t).x"
          :y2="pt(R - (t % 50 === 0 && t !== 0 ? 10 : 6), t).y"
          stroke="rgb(148 163 184 / 0.7)"
          :stroke-width="t % 50 === 0 ? 2 : 1"
          stroke-linecap="round"
        />
        <text
          :x="pt(R - 18, t).x"
          :y="pt(R - 18, t).y"
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-slate-500 font-medium tabular-nums"
          style="font-size: 8px"
        >
          {{ t }}
        </text>
      </g>

      <!-- Needle -->
      <line
        :x1="cx"
        :y1="cy"
        :x2="needleEnd.x"
        :y2="needleEnd.y"
        :stroke="accentHex"
        stroke-width="2.5"
        stroke-linecap="round"
        :filter="`url(#ls-spd-glow-${uid})`"
      />
      <circle :cx="cx" :cy="cy" :r="hubR + 1.5" fill="rgb(15 23 42)" stroke="rgb(51 65 85)" stroke-width="1" />
      <circle :cx="cx" :cy="cy" :r="hubR" :fill="accentHex" opacity="0.95" />
    </svg>
    <template v-if="!embedded">
      <p class="mt-1 max-w-[8.5rem] truncate text-center text-[10px] font-medium text-slate-400">
        {{ label }}
      </p>
      <p class="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-white">
        {{ Math.round(score) }}
        <span class="text-sm font-medium text-slate-500">/100</span>
      </p>
    </template>
  </div>
</template>
