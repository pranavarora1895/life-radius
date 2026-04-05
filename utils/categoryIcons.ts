import type { AnchorCategory } from '~/types'

/** Lucide (Iconify) ids for anchor categories — MIT-licensed Lucide via `@iconify-json/lucide`. */
const ICONS: Record<AnchorCategory, string> = {
  work: 'lucide:briefcase',
  school: 'lucide:graduation-cap',
  gym: 'lucide:dumbbell',
  grocery: 'lucide:shopping-basket',
  gas: 'lucide:fuel',
  pharmacy: 'lucide:pill',
  social: 'lucide:users-round',
  custom: 'lucide:map-pin',
}

export function categoryIconName(category: AnchorCategory): string {
  return ICONS[category]
}
