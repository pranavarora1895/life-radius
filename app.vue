<script setup lang="ts">
import { SITE_TITLE } from '~/constants/seo'

/** Ensures tab title updates even when `nuxt.config` head is not hot-reloaded. */
useHead({
  title: SITE_TITLE,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
