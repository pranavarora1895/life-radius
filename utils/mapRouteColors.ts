import type { AnchorCategory } from '~/types'

/** Main line color per stop type (home → this anchor). */
export const ROUTE_LINE_BY_CATEGORY: Record<AnchorCategory, string> = {
  work: '#2563eb',
  school: '#6366f1',
  grocery: '#0284c7',
  gas: '#ca8a04',
  pharmacy: '#059669',
  gym: '#ea580c',
  social: '#db2777',
  custom: '#64748b',
}

/** Pin fill to match the route color for the same anchor. */
export const ANCHOR_MARKER_BG: Record<AnchorCategory, string> = ROUTE_LINE_BY_CATEGORY

export const ROUTE_CATEGORY_LABEL: Record<AnchorCategory, string> = {
  work: 'Work',
  school: 'School',
  grocery: 'Grocery',
  gas: 'Gas',
  pharmacy: 'Pharmacy',
  gym: 'Gym',
  social: 'Social',
  custom: 'Place',
}
