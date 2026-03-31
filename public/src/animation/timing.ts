// Centralized timing values used across UI code (ms for timeouts, s for Motion durations)
export const NOTICE_HOLD_ALT_SEARCH_MS = 1000; // used after alt search completes
export const NOTICE_HOLD_LIST_COMPLETE_MS = 1500; // used after list fully loads
export const TOAST_DEFAULT_DURATION_MS = 3000; // default toast duration
export const TMDB_DEBOUNCE_MS = 120; // input debounce for TMDB searches

// Motion durations (seconds) — keep in sync with poster CSS feel
export const POSTER_HOVER_TRANSFORM_S = 0.28;
export const POSTER_IMAGE_TRANSFORM_S = 0.36;
export const POSTER_OVERLAY_OPACITY_S = 0.18;

// Shared easing (cubic-bezier(0.2, 0.9, 0.2, 1)) — Motion accepts arrays
export const EASE_CUBIC_BEZIER: [number, number, number, number] = [0.2, 0.9, 0.2, 1];

// Helper for motion transitions
export function motionTransition(durationS: number) {
  return { duration: durationS, ease: EASE_CUBIC_BEZIER };
}

// Interaction timing for small hover/tap feedback
export const INTERACTION_FAST_S = 0.18;
