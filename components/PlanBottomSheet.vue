<script setup lang="ts">
const PEEK_MIN = 120
const PEEK_DEFAULT = 136

const MOVE_OPTS = { passive: false } as const

const sheetHeight = ref(PEEK_DEFAULT)
const maxSheetPx = ref(600)
const dragging = ref(false)

const sheetEl = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

/** When the form is scrolled, don’t steal the gesture — let the user scroll. When at top, bubble → sheet drag. */
function onScrollPointerDown(e: PointerEvent) {
  const el = scrollRef.value
  if (el && el.scrollTop > 0) {
    e.stopPropagation()
  }
}

let dragStartY = 0
let heightAtDragStart = 0
let captureEl: HTMLElement | null = null
let blockDocumentTouch: ((e: TouchEvent) => void) | null = null

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function recomputeMax() {
  if (typeof window === 'undefined') return
  maxSheetPx.value = Math.min(Math.round(window.innerHeight * 0.92), 900)
  sheetHeight.value = clamp(sheetHeight.value, PEEK_MIN, maxSheetPx.value)
}

const isExpanded = computed(() => {
  const max = maxSheetPx.value
  if (max <= PEEK_MIN + 1) return false
  const h = sheetHeight.value
  return h >= max - 40 || h / max >= 0.9
})

function snapHeight(h: number) {
  const max = maxSheetPx.value
  const peek = PEEK_DEFAULT
  const midpoint = (peek + max) / 2
  return h < midpoint ? peek : max
}

function detachDragListeners() {
  window.removeEventListener('pointermove', onDragMove, MOVE_OPTS)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const delta = dragStartY - e.clientY
  e.preventDefault()
  sheetHeight.value = clamp(heightAtDragStart + delta, PEEK_MIN, maxSheetPx.value)
}

function endDrag(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  detachDragListeners()
  if (blockDocumentTouch) {
    document.removeEventListener('touchmove', blockDocumentTouch)
    blockDocumentTouch = null
  }
  if (captureEl) {
    try {
      captureEl.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    captureEl = null
  }
  sheetHeight.value = snapHeight(sheetHeight.value)
}

function isInteractiveTarget(el: EventTarget | null) {
  if (!(el instanceof Element)) return false
  return Boolean(el.closest('button, a, input, textarea, select, label, [role="slider"]'))
}

/**
 * One drag surface for the whole sheet: drag down to shrink toward the bottom, up to expand.
 * Fires from the root so any touch inside the panel (except controls) drags the sheet.
 */
function startSheetDrag(e: PointerEvent) {
  if (isInteractiveTarget(e.target)) return
  e.preventDefault()
  const el = sheetEl.value
  if (!el) return
  try {
    el.setPointerCapture(e.pointerId)
    captureEl = el
  } catch {
    captureEl = null
  }
  dragging.value = true
  dragStartY = e.clientY
  heightAtDragStart = sheetHeight.value

  blockDocumentTouch = (ev: TouchEvent) => {
    if (ev.cancelable) ev.preventDefault()
  }
  document.addEventListener('touchmove', blockDocumentTouch, { passive: false })

  window.addEventListener('pointermove', onDragMove, MOVE_OPTS)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

onMounted(() => {
  recomputeMax()
  window.addEventListener('resize', recomputeMax)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeMax)
  detachDragListeners()
  if (blockDocumentTouch) {
    document.removeEventListener('touchmove', blockDocumentTouch)
  }
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
    ref="sheetEl"
    class="pointer-events-auto fixed bottom-0 left-0 right-0 z-40 flex max-h-[92dvh] min-h-0 touch-none flex-col rounded-t-2xl border border-slate-700/90 bg-slate-900/98 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden"
    :class="dragging ? '' : 'transition-[height] duration-200 ease-out'"
    :style="{
      height: `${sheetHeight}px`,
      minHeight: `${PEEK_MIN}px`,
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
    }"
    role="dialog"
    aria-label="Locations and travel settings"
    @pointerdown="startSheetDrag"
  >
    <div
      data-sheet-handle
      class="flex shrink-0 flex-col border-b border-slate-800/90 bg-slate-900/95"
    >
      <div class="flex cursor-grab flex-col items-center gap-1 py-2.5 active:cursor-grabbing">
        <div class="h-1 w-11 shrink-0 rounded-full bg-slate-500/90" aria-hidden="true" />
      </div>
      <div class="flex w-full items-center gap-2 px-4 pb-2.5 pt-0.5">
        <div class="min-w-0 flex-1 cursor-grab py-1 active:cursor-grabbing">
          <p class="text-xs font-semibold text-slate-200">Locations &amp; travel</p>
        </div>
        <div class="flex shrink-0 items-center gap-0.5" @pointerdown.stop>
          <button
            type="button"
            class="touch-manipulation rounded-md px-2 py-1.5 text-[11px] font-medium text-cyan-400/90 hover:bg-slate-800/80"
            @click.stop="isExpanded ? collapseToPeek() : expand()"
          >
            {{ isExpanded ? 'Collapse' : 'Expand' }}
          </button>
          <button
            type="button"
            class="touch-manipulation rounded-lg p-2 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100"
            aria-label="Minimize panel to bottom of screen"
            title="Minimize"
            @click.stop="collapseToPeek()"
          >
            <Icon name="lucide:x" class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
    <!-- touch-pan-y re-enables vertical scrolling; @pointerdown stops bubbling only when already scrolled -->
    <div
      ref="scrollRef"
      class="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-3 pt-3 [-webkit-overflow-scrolling:touch]"
      @pointerdown="onScrollPointerDown"
    >
      <slot />
    </div>
  </div>
</template>
