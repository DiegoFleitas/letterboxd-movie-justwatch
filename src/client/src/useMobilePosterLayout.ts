import { useEffect, useState } from "react";

/** Matches `.poster-showcase` mobile grid breakpoint in poster.css */
export const MOBILE_POSTER_MEDIA_QUERY = "(max-width: 767px)";

function getInitialMobileMatch(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_POSTER_MEDIA_QUERY).matches;
}

export function useMobilePosterLayout(): boolean {
  const [isMobile, setIsMobile] = useState(getInitialMobileMatch);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(MOBILE_POSTER_MEDIA_QUERY);
    const sync = (): void => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
