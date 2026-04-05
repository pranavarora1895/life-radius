import type { InjectionKey } from 'vue'

/** Full reset + return to Plan tab (provided by `pages/index.vue`). */
export const lifeRadiusResetKey: InjectionKey<() => void> = Symbol('lifeRadiusReset')
