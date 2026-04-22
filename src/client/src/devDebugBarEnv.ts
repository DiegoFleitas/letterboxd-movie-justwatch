/** Split from DevDebugBar so Vitest can mock dev vs prod. */
export function isViteDev(): boolean {
  return Boolean(import.meta.env.DEV);
}
