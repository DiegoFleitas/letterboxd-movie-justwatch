/** Split from DevDebugBar so Vitest can mock dev vs prod. */

/**
 * Whether the floating dev debug bar should load (Vite dev only).
 * Set `VITE_DEV_DEBUG_BAR=false` in `.env.development.local` to hide it; unset or any other value keeps it on in dev.
 */
export function isDevDebugBarEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_DEV_DEBUG_BAR !== "false";
}
