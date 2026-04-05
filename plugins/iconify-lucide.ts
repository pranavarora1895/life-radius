import type { IconifyJSON } from '@iconify/types'
import lucide from '@iconify-json/lucide/icons.json'
import { addCollection } from '@iconify/vue/offline'

addCollection(lucide as IconifyJSON)

export default defineNuxtPlugin(() => {})
