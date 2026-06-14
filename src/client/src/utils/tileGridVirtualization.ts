/**
 * Spike flag: render the tile grid with windowing instead of the animated
 * AnimatePresence grid. Enabled with `VITE_VIRTUALIZE=1`. Off by default so the
 * existing animated reveal stays the production behaviour while we A/B the feel.
 */
export function isTileGridVirtualized(): boolean {
  return import.meta.env.VITE_VIRTUALIZE === "1";
}
