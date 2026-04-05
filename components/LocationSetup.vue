<script setup lang="ts">
import type { Anchor } from '~/types'
import { categoryIconName } from '~/utils/categoryIcons'
import { GROCERY_ANCHOR_CAP, GROCERY_MAX_DISTANCE_KM } from '~/utils/mapboxApi'

const props = withDefaults(
  defineProps<{
    /** Omit outer card chrome when nested inside a parent card. */
    embedded?: boolean
    /** Show values only (no search, clear, or refresh). */
    readonly?: boolean
  }>(),
  { embedded: false, readonly: false },
)

const {
  anchors,
  candidateHome,
  candidateHomeLabel,
  candidateHomeAddress,
  workPlace,
  schoolPlace,
  discoveringPois,
  poiDiscoverError,
  setCandidateHome,
  clearCandidateHome,
  setWorkPlace,
  setSchoolPlace,
  refreshNearbyPlaces,
} = useLifeRadius()

const config = useRuntimeConfig()
const hasToken = computed(() => Boolean(config.public.mapboxAccessToken))

const homeLocationLine = computed(() => {
  if (!candidateHome.value) return null
  return (
    candidateHomeAddress.value?.trim() ||
    candidateHomeLabel.value?.trim() ||
    `${candidateHome.value.lat.toFixed(4)}, ${candidateHome.value.lng.toFixed(4)}`
  )
})

const categoryLabels: Record<Anchor['category'], string> = {
  work: 'Work',
  school: 'School',
  gym: 'Gym',
  grocery: 'Grocery',
  gas: 'Gas',
  pharmacy: 'Pharmacy',
  social: 'Social',
  custom: 'Custom',
}

function onHomeSelect(p: { lngLat: { lng: number; lat: number }; label: string }) {
  setCandidateHome(p.lngLat, p.label, true)
}

function onWorkSelect(p: { lngLat: { lng: number; lat: number }; label: string }) {
  setWorkPlace({ lngLat: p.lngLat, label: p.label, address: p.label })
}

function onSchoolSelect(p: { lngLat: { lng: number; lat: number }; label: string }) {
  setSchoolPlace({ lngLat: p.lngLat, label: p.label, address: p.label })
}
</script>

<template>
  <component
    :is="embedded ? 'div' : 'section'"
    :class="
      embedded
        ? 'min-h-0 bg-transparent'
        : 'rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-4 shadow-[0_0_32px_rgba(34,211,238,0.06)] backdrop-blur-xl'
    "
  >
    <template v-if="!embedded">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon name="lucide:map-pinned" class="size-4 shrink-0 text-cyan-400" aria-hidden="true" />
        Locations
      </h2>
      <p class="mt-1 text-xs leading-relaxed text-slate-200">
        Set the home you are evaluating. Optionally add work and school. We pick up to {{ GROCERY_ANCHOR_CAP }} nearby groceries (within ~{{ GROCERY_MAX_DISTANCE_KM }} km straight-line), plus a gas station, pharmacy, gym, and social spot
        (restaurant, pub, or café) automatically.
      </p>
    </template>

    <div :class="embedded ? 'space-y-4' : 'mt-5 space-y-5'">
      <template v-if="readonly">
        <p v-if="props.embedded" class="text-xs text-slate-300">
          View only — edit locations on <span class="font-medium text-cyan-200/90">Plan &amp; map</span>.
        </p>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Candidate home</dt>
            <dd class="mt-1 text-slate-100">
              {{ homeLocationLine ?? '—' }}
            </dd>
          </div>
          <div v-if="workPlace">
            <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Work</dt>
            <dd class="mt-1 text-slate-100">
              {{ workPlace.address?.trim() || workPlace.label }}
            </dd>
          </div>
          <div v-if="schoolPlace">
            <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">School</dt>
            <dd class="mt-1 text-slate-100">
              {{ schoolPlace.address?.trim() || schoolPlace.label }}
            </dd>
          </div>
        </dl>
      </template>

      <template v-else>
        <div>
          <AddressSearch
            label="Candidate home"
            placeholder="Search address for home"
            :proximity="null"
            @select="onHomeSelect"
          />
          <p v-if="homeLocationLine" class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span class="font-medium text-slate-200">Selected:</span>
            <span class="max-w-full truncate">{{ homeLocationLine }}</span>
            <button
              type="button"
              class="text-cyan-400 underline decoration-cyan-500/50 hover:text-cyan-300"
              @click="clearCandidateHome"
            >
              Clear home
            </button>
          </p>
          <p class="mt-1 text-[11px] leading-snug text-slate-300">
            Or click the map and choose Home, Work, or School (each location once).
          </p>
        </div>

        <AddressSearch
          label="Work"
          optional
          :selected-label="workPlace?.label ?? null"
          :proximity="candidateHome"
          placeholder="Search workplace"
          @select="onWorkSelect"
          @clear="setWorkPlace(null)"
        />

        <AddressSearch
          label="School"
          optional
          :selected-label="schoolPlace?.label ?? null"
          :proximity="candidateHome"
          placeholder="Search school or campus"
          @select="onSchoolSelect"
          @clear="setSchoolPlace(null)"
        />

        <div class="flex flex-wrap items-center gap-2 border-t border-slate-700/80 pt-4">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950/40 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/40 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!candidateHome || !hasToken || discoveringPois"
            @click="refreshNearbyPlaces"
          >
            <Icon
              name="lucide:refresh-cw"
              class="size-3.5 shrink-0"
              :class="discoveringPois ? 'animate-spin' : ''"
              aria-hidden="true"
            />
            {{ discoveringPois ? 'Refreshing…' : 'Refresh nearby places' }}
          </button>
          <span v-if="discoveringPois" class="text-xs text-slate-400">Finding groceries, gas, pharmacy, gym, and social…</span>
        </div>

        <p v-if="poiDiscoverError" class="text-xs text-red-400">{{ poiDiscoverError }}</p>
      </template>

      <div v-if="anchors.length" class="rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
        <p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Places in score</p>
        <ul class="mt-2 space-y-2">
          <li
            v-for="a in anchors"
            :key="a.id"
            class="flex flex-wrap items-baseline justify-between gap-2 text-xs"
          >
            <span class="inline-flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="inline-flex min-w-0 items-center gap-1.5 font-medium text-slate-100">
                <Icon :name="categoryIconName(a.category)" class="size-3.5 shrink-0 text-cyan-500/70" aria-hidden="true" />
                <span class="truncate">{{ a.name }}</span>
              </span>
              <span
                v-if="a.addressSubtitle"
                class="truncate pl-[22px] text-[10px] leading-snug text-slate-400"
              >
                {{ a.addressSubtitle }}
              </span>
            </span>
            <span class="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300">
              {{ categoryLabels[a.category] }} · importance {{ a.weight }}
            </span>
          </li>
        </ul>
      </div>
      <p v-else-if="candidateHome && !discoveringPois && !anchors.length" class="text-xs text-slate-300">
        <template v-if="readonly">No places listed for this score.</template>
        <template v-else>
          No places yet. Set a home on the map first, or tap Refresh nearby places after your home is set.
        </template>
      </p>
    </div>
  </component>
</template>
