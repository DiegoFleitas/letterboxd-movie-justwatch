import { useEffect, useState } from "react";

/** Matches `.poster-showcase` mobile grid breakpoint in poster.css */
export const MOBILE_POSTER_MEDIA_QUERY = "(max-width: 767px)";

function getGlobalWindow(): (Window & typeof globalThis) | undefined {
  return globalThis.window;
}

function getInitialMobileMatch(): boolean {
  const win = getGlobalWindow();
  if (win === undefined || typeof win.matchMedia !== "function") {
    return false;
  }
  return win.matchMedia(MOBILE_POSTER_MEDIA_QUERY).matches;
}

export function useMobilePosterLayout(): boolean {
  const [isMobile, setIsMobile] = useState(getInitialMobileMatch);

  useEffect(() => {
    const win = getGlobalWindow();
    if (win === undefined || typeof win.matchMedia !== "function") {
      return;
    }
    const mq = win.matchMedia(MOBILE_POSTER_MEDIA_QUERY);
    const sync = (): void => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
