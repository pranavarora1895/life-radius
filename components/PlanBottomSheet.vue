<script setup lang="ts">
/** Minimum height (px): drag bar stays usable. */
const PEEK_MIN = 80
const PEEK_DEFAULT = 120

const sheetHeight = ref(PEEK_DEFAULT)
const maxSheetPx = ref(600)
const dragging = ref(false)

let dragStartY = 0
let heightAtDragStart = 0

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function recomputeMax() {
  if (typeof window === 'undefined') return
  maxSheetPx.value = Math.min(Math.round(window.innerHeight * 0.92), 900)
  sheetHeight.value = clamp(sheetHeight.value, PEEK_MIN, maxSheetPx.value)
}

/** True when the sheet is at (or near) full height — relaxed so Expand/Collapse stays in sync after drag/snap. */
const isExpanded = computed(() => {
  const max = maxSheetPx.value
  if (max <= PEEK_MIN + 1) return false
  const h = sheetHeight.value
  return h >= max - 40 || h / max >= 0.9
})

function snapHeight(h: number) {
  const max = maxSheetPx.value
  const mid = (PEEK_MIN + max) / 2
  if (h < mid) return h < (PEEK_MIN + mid) / 2 ? PEEK_MIN : Math.round(mid)
  return h > (mid + max) / 2 ? max : Math.round(mid)
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const delta = dragStartY - e.clientY
  sheetHeight.value = clamp(heightAtDragStart + delta, PEEK_MIN, maxSheetPx.value)
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  sheetHeight.value = snapHeight(sheetHeight.value)
}

function onHandlePointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  dragging.value = true
  dragStartY = e.clientY
  heightAtDragStart = sheetHeight.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

onMounted(() => {
  recomputeMax()
  window.addEventListener('resize', recomputeMax)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeMax)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
})

function expand() {
  recomputeMax()
  sheetHeight.value = maxSheetPx.value
}

function collapseToPeek() {
  sheetHeight.value = PEEK_DEFAULT
}
</script>

<template>
  <div
    class="pointer-events-auto fixed bottom-0 left-0 right-0 z-40 flex max-h-[92dvh] flex-col rounded-t-2xl border border-slate-700/90 bg-slate-900/98 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden"
    :class="dragging ? '' : 'transition-[height] duration-200 ease-out'"
    :style="{
      height: `${sheetHeight}px`,
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
    }"
    role="dialog"
    aria-label="Locations and travel settings"
  >
    <div
      data-sheet-handle
      class="flex shrink-0 flex-col border-b border-slate-800/90 bg-slate-900/95"
    >
      <div
        class="flex cursor-grab touch-none flex-col items-center gap-1 py-2.5 active:cursor-grabbing"
        @pointerdown="onHandlePointerDown"
      >
        <div class="h-1 w-11 shrink-0 rounded-full bg-slate-500/90" aria-hidden="true" />
      </div>
      <div class="flex w-full items-center justify-between gap-2 px-4 pb-2.5 pt-0.5">
        <div
          class="min-w-0 flex-1 cursor-grab py-1 active:cursor-grabbing"
          @pointerdown="onHandlePointerDown"
        >
          <p class="text-xs font-semibold text-slate-200">Locations &amp; travel</p>
        </div>
        <button
          type="button"
          class="touch-manipulation rounded-md px-2 py-1 text-[11px] font-medium text-cyan-400/90 hover:bg-slate-800/80"
          @pointerdown.stop
          @click.stop="isExpanded ? collapseToPeek() : expand()"
        >
          {{ isExpanded ? 'Collapse' : 'Expand' }}
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3">
      <slot />
    </div>
  </div>
</template>
