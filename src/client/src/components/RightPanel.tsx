import React, { useState, useMemo, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTransition } from "../animation/timing";
import { useAppState } from "./AppStateContext";
import { getTileProviderNames } from "../utils/movieTiles";
import type { TileData } from "../utils/movieTiles";
import { VirtualizedPosterShowcase } from "./VirtualizedPosterShowcase";
import { WaitCue } from "./WaitCue";
import {
  createProviderFilterSet,
  deduplicateProviderList,
  tileMatchesProviderFilter,
  type ProviderLike,
} from "../utils/providerUtils";

const FOOTER_MESSAGES = [
  "Star me on GitHub!",
  "Try uBlock Origin!",
  "Use magnet links!",
  "Try alternative search!",
  "Watch 'The Thing'!",
  "Watch 'Kill Bill: Vol. 1'!",
  "Watch 'Raiders of the Lost Ark'!",
  "Watch 'Cinema Paradiso'!",
  "Watch 'Gremlins'!",
  "Watch 'Rocky'!",
  "Watch 'Ferris Bueller's Day Off'!",
  "Also try Terraria!",
  "Also try Minecraft!",
  "Try Radarr & letterboxd-list-radarr!",
  "Try Sonarr & mal-list-sonarr!",
  "Try Plex!",
];

function getRandomMessage(): string {
  return FOOTER_MESSAGES[Math.floor(Math.random() * FOOTER_MESSAGES.length)];
}

export function RightPanel(): React.ReactElement {
  const {
    movieTiles: tiles,
    streamingProviders: providers,
    runAlternativeSearch,
    isAlternativeSearchLoading,
  } = useAppState();
  const reduceMotion = useReducedMotion();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [footerMessage] = useState(() => getRandomMessage());

  const toggleFilter = (name: string): void => {
    setActiveFilters((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const [focusedProvider, setFocusedProvider] = useState<string | null>(null);
  const PROVIDER_FAST_S = 0.12;

  const tileList = useMemo(() => Object.values(tiles), [tiles]);
  const providerList = useMemo(
    () => deduplicateProviderList(Object.values(providers)),
    [providers],
  );

  const visibleTiles = useMemo((): TileData[] => {
    const filterSet = createProviderFilterSet(activeFilters);
    return tileList.filter((tile: TileData) => {
      const names = getTileProviderNames(tile);
      if (!filterSet) return true;
      if (!names.length) return false;
      return tileMatchesProviderFilter(names, filterSet);
    });
  }, [tileList, activeFilters]);

  const handleAlternativeSearch = useCallback(
    (tileData: TileData): void => {
      runAlternativeSearch?.(tileData.title, tileData.year ?? undefined);
    },
    [runAlternativeSearch],
  );

  return (
    <>
      {isAlternativeSearchLoading ? (
        <div className="activity-strip" role="status" aria-live="polite">
          <WaitCue size="sm" />
          <span>Searching alternate sources...</span>
        </div>
      ) : null}
      <div id="icons-container-main" data-testid="provider-icons">
        {providerList.map((provider: ProviderLike) => {
          const isActive = activeFilters.includes(provider.name);
          return (
            <motion.button
              type="button"
              key={provider.id}
              className={`streaming-provider-icon ${isActive ? "active" : ""}`}
              data-sp={provider.name}
              title={provider.name}
              aria-pressed={isActive}
              onClick={() => toggleFilter(provider.name)}
              onFocus={() => setFocusedProvider(provider.name)}
              onBlur={() => setFocusedProvider((prev) => (prev === provider.name ? null : prev))}
              onMouseEnter={() => setFocusedProvider(provider.name)}
              onMouseLeave={() =>
                setFocusedProvider((prev) => (prev === provider.name ? null : prev))
              }
              initial={"idle"}
              animate={isActive ? "selected" : "idle"}
              whileHover={reduceMotion ? undefined : "hover"}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              variants={{
                idle: { scale: 1, y: 0 },
                selected: { scale: 1.04, y: -0.8 },
                hover: { scale: 1.02, y: -0.4 },
              }}
              transition={motionTransition(PROVIDER_FAST_S)}
            >
              <img src={provider.icon ?? ""} alt={provider.name} />
              {/* tooltip (also shown on focus) */}
              <motion.span
                className="provider-tooltip"
                variants={{ idle: { opacity: 0, y: 6 }, hover: { opacity: 1, y: 0 } }}
                initial="idle"
                animate={focusedProvider === provider.name ? "hover" : "idle"}
                aria-hidden
                transition={motionTransition(PROVIDER_FAST_S)}
              >
                {provider.name}
              </motion.span>
              {isActive && (
                <motion.span
                  className="provider-badge"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={motionTransition(PROVIDER_FAST_S)}
                  aria-hidden
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="poster-showcase" data-testid="poster-showcase">
        <VirtualizedPosterShowcase
          tiles={visibleTiles}
          onAlternativeSearch={handleAlternativeSearch}
        />
      </div>
      <footer>
        <div id="minecraft-text">{footerMessage}</div>
        <p className="foot-notes">
          This site helps you find where to watch <u>Movies</u>, not TV shows. It cross-checks
          JustWatch, TMDB, and OMDb so the results are accurate. If it can&apos;t find the movie you
          want, it won&apos;t suggest random stuff. <br />
          Please don&apos;t use torrent or piracy sites. Unauthorized downloads violate copyright,
          so we can&apos;t recommend them. We get it: some titles aren&apos;t legally available
          anywhere, or only with <u>bad dubbing and no subtitles</u>. Still, stick to legal options
          when you can.
        </p>
        <details className="jackett-details">
          <summary className="jackett-summary">What&apos;s Alternative search?</summary>
          <div className="jackett-body">
            It uses the Jackett API to search torrent indexers like 1337x and RARBG.
          </div>
        </details>
      </footer>
    </>
  );
}
