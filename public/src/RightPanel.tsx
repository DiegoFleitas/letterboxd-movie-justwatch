import React, { useState, useMemo, useCallback, startTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motionTransition } from "./animation/timing";
import { useAppState } from "./AppStateContext";
import { getTileProviderNames } from "./movieTiles";
import type { TileData } from "./movieTiles";
import { MovieTile } from "./MovieTile";
import {
  deduplicateProviderList,
  tileMatchesProviderFilter,
  type ProviderLike,
} from "./providerUtils";

const FOOTER_MESSAGES = [
  "Star me on GitHub!",
  "Try uBlock Origin!",
  "Use magnet links!",
  "Click pirate flags!",
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

const PROVIDER_FAST_S = 0.12;

export function RightPanel(): React.ReactElement {
  const {
    movieTiles: tiles,
    streamingProviders: providers,
    runAlternativeSearch,
    showAltSearchButton,
  } = useAppState();
  const reduceMotion = useReducedMotion();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [altSearchFilter, setAltSearchFilter] = useState(false);
  const [footerMessage] = useState(() => getRandomMessage());
  const [suppressAnimations, setSuppressAnimations] = useState(false);

  const toggleFilter = (name: string): void => {
    startTransition(() => {
      setActiveFilters((prev) => {
        const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
        // if we're clearing the last active filter, skip mount/exit animations briefly
        if (prev.length > 0 && next.length === 0) {
          setSuppressAnimations(true);
          // keep suppressed for a short time so the large DOM update doesn't animate
          setTimeout(() => setSuppressAnimations(false), Math.max(160, PROVIDER_FAST_S * 1000));
        }
        return next;
      });
    });
  };

  const toggleAltSearchFilter = (): void => {
    startTransition(() => {
      setAltSearchFilter((prev) => !prev);
    });
  };

  const tileList = useMemo(() => Object.values(tiles), [tiles]);
  const providerList = useMemo(
    () => deduplicateProviderList(Object.values(providers)),
    [providers],
  );

  const visibleTiles = useMemo((): TileData[] => {
    return tileList.filter((tile: TileData) => {
      const names = getTileProviderNames(tile);
      if (altSearchFilter) return names.length > 0;
      if (!activeFilters.length) return true;
      if (!names.length) return false;
      return tileMatchesProviderFilter(names, activeFilters);
    });
  }, [tileList, activeFilters, altSearchFilter]);

  const handleAlternativeSearch = useCallback(
    (tileData: TileData): void => {
      runAlternativeSearch?.(tileData.title, tileData.year ?? undefined);
    },
    [runAlternativeSearch],
  );

  return (
    <>
      <div id="icons-container-main" data-testid="provider-icons">
        {providerList.map((provider: ProviderLike) => {
          const isActive = activeFilters.includes(provider.name);
          return (
            <motion.div
              key={provider.id}
              className={`streaming-provider-icon ${isActive ? "active" : ""}`}
              data-sp={provider.name}
              title={provider.name}
              role="button"
              tabIndex={0}
              onClick={() => toggleFilter(provider.name)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter") toggleFilter(provider.name);
                else if (e.key === " ") {
                  e.preventDefault();
                  toggleFilter(provider.name);
                }
              }}
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
              <span className="provider-tooltip" aria-hidden>
                {provider.name}
              </span>
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
            </motion.div>
          );
        })}
        {showAltSearchButton ? (
          <motion.div
            className={`streaming-provider-icon ${altSearchFilter ? "active" : ""}`}
            data-sp="alternative search"
            title="Alternative search"
            onClick={toggleAltSearchFilter}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") toggleAltSearchFilter();
              else if (e.key === " ") {
                e.preventDefault();
                toggleAltSearchFilter();
              }
            }}
            initial={"idle"}
            animate={altSearchFilter ? "selected" : "idle"}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            variants={{ idle: { scale: 1, y: 0 }, selected: { scale: 1.04, y: -0.8 } }}
            transition={motionTransition(PROVIDER_FAST_S)}
          >
            <img
              src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>"
              alt="alternative Search"
            />
          </motion.div>
        ) : null}
      </div>
      <div className="poster-showcase" data-testid="poster-showcase">
        {suppressAnimations ? (
          visibleTiles.map((tile, idx) => (
            <MovieTile
              key={tile.id}
              data={tile}
              index={idx}
              onAlternativeSearch={handleAlternativeSearch}
              suppressAnimations
            />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {visibleTiles.map((tile, idx) => (
              <MovieTile
                key={tile.id}
                data={tile}
                index={idx}
                onAlternativeSearch={handleAlternativeSearch}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
      <footer>
        <div id="minecraft-text">{footerMessage}</div>
        <p className="foot-notes">
          This site helps you find where to watch <u>Movies</u>, not TV shows. It checks everything
          with JustWatch & TMDB & OMDb API to make sure it&apos;s accurate. If it can&apos;t find
          the movie you want, it won&apos;t suggest random stuff. <br />
          Please don&apos;t use torrent or piracy sites—unauthorized downloads violate copyright and
          we can&apos;t recommend them. We get it: some titles aren&apos;t legally available
          anywhere, or only with <u>bad dubbing and no subtitles</u>. Still, stick to legal options
          when you can.
        </p>
        <details className="jackett-details">
          <summary className="jackett-summary">
            Why pirate flags? <span className="icons">🏴‍☠️</span>
          </summary>
          <div className="jackett-body">
            It uses Jackett API to search for torrents on 1337x, RARBG, etc.
          </div>
        </details>
      </footer>
    </>
  );
}
