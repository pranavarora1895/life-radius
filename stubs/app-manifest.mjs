/**
 * Satisfies Vite’s static analysis of `import("#app-manifest")` in Nuxt’s manifest composable.
 * With `experimental.appManifest: false`, this path is never executed at runtime.
 */
export default { id: '', prerendered: [] }
