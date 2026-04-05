<script setup lang="ts">
const open = defineModel<boolean>({ default: false })

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="psd-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-black/55 lg:hidden"
        aria-hidden="true"
        @click="close"
      />
    </Transition>
    <Transition name="psd-slide">
      <aside
        v-if="open"
        class="fixed right-0 top-0 z-[61] flex h-[100dvh] w-[min(100vw-0.75rem,22rem)] max-w-[calc(100vw-0.5rem)] flex-col border-l border-slate-600/90 bg-slate-900 shadow-[-8px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-side-drawer-title"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/90 bg-slate-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <h2 id="plan-side-drawer-title" class="text-sm font-semibold tracking-tight text-white">
            Locations &amp; travel
          </h2>
          <button
            type="button"
            class="touch-manipulation inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-500/80 bg-slate-800/90 text-white shadow-sm hover:bg-slate-700 hover:text-white active:bg-slate-600"
            aria-label="Close panel"
            @click="close"
          >
            <Icon name="lucide:x" class="size-6" aria-hidden="true" />
          </button>
        </header>
        <div
          class="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-slate-200 [-webkit-overflow-scrolling:touch] antialiased"
        >
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.psd-fade-enter-active,
.psd-fade-leave-active {
  transition: opacity 0.2s ease;
}
.psd-fade-enter-from,
.psd-fade-leave-to {
  opacity: 0;
}
.psd-slide-enter-active,
.psd-slide-leave-active {
  transition: transform 0.22s ease;
}
.psd-slide-enter-from,
.psd-slide-leave-to {
  transform: translateX(100%);
}
</style>
