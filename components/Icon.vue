<script setup lang="ts">
import { Icon as IconifyIcon } from '@iconify/vue/offline'

defineOptions({ inheritAttrs: false })

defineProps<{
  /** Iconify id, e.g. `lucide:home` (Lucide is bundled locally via `plugins/iconify-lucide`). */
  name: string
}>()
</script>

<template>
  <IconifyIcon :icon="name" v-bind="$attrs" />
</template>
