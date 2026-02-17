import { useState, useMemo } from "react";
import { useAppState } from "./AppStateContext.jsx";
import { getTileProviderNames } from "./movieTiles.js";
import { MovieTile } from "./MovieTile.jsx";

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

function getRandomMessage() {
  return FOOTER_MESSAGES[Math.floor(Math.random() * FOOTER_MESSAGES.length)];
}

export function RightPanel() {
  const { movieTiles: tiles, streamingProviders: providers, runAlternativeSearch } = useAppState();
  const [activeFilters, setActiveFilters] = useState([]);
  const [altSearchFilter, setAltSearchFilter] = useState(false);
  const [footerMessage] = useState(() => getRandomMessage());

  const toggleFilter = (name) => {
    setActiveFilters((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleAltSearchFilter = () => {
    setAltSearchFilter((prev) => !prev);
  };

  const tileList = useMemo(() => Object.values(tiles), [tiles]);
  const providerList = useMemo(() => Object.values(providers).filter((p) => p?.name), [providers]);

  const visibleTiles = useMemo(() => {
    return tileList.filter((tile) => {
      const names = getTileProviderNames(tile);
      if (altSearchFilter) return names.length > 0;
      if (!activeFilters.length) return true;
      if (!names.length) return false;
      return activeFilters.some((f) => names.includes(f));
    });
  }, [tileList, activeFilters, altSearchFilter]);

  const handleAlternativeSearch = (tileData) => {
    runAlternativeSearch?.(tileData.title, tileData.year);
  };

  return (
    <>
      <div id="icons-container-main" data-testid="provider-icons">
        {providerList.map((provider) => (
          <div
            key={provider.id}
            className={`streaming-provider-icon ${activeFilters.includes(provider.name) ? "active" : ""}`}
            data-sp={provider.name}
            onClick={() => toggleFilter(provider.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                toggleFilter(provider.name);
              } else if (e.key === " ") {
                e.preventDefault();
                toggleFilter(provider.name);
              }
            }}
          >
            <img src={provider.icon} alt={provider.name} />
          </div>
        ))}
        <div
          className={`streaming-provider-icon ${altSearchFilter ? "active" : ""}`}
          data-sp="alternative search"
          onClick={toggleAltSearchFilter}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              toggleAltSearchFilter();
            } else if (e.key === " ") {
              e.preventDefault();
              toggleAltSearchFilter();
            }
          }}
        >
          <img
            src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>"
            alt="alternative Search"
          />
        </div>
      </div>
      <div className="poster-showcase" data-testid="poster-showcase">
        {visibleTiles.map((tile) => (
          <MovieTile
            key={tile.id}
            data={tile}
            onAlternativeSearch={handleAlternativeSearch}
          />
        ))}
      </div>
      <footer>
        <div id="minecraft-text">{footerMessage}</div>
        <p className="foot-notes">
          This site helps you find where to watch <u>Movies</u>, not TV shows.
          It checks everything with JustWatch & TMDB & OMDb API to make sure
          it's accurate. If it can't find the movie you want, it won't suggest
          random stuff. <br />
          Oh! & <i>don't download from torrent sites because it's not
          cool with copyright laws or smt like that.
          Even if the movie you want to watch is not available in any other way,
          or if the streaming providers offer it but butcher the movie with <u>bad dubbing & no subs!!</u></i>
        </p>
        <p className="foot-notes spoiler">
          <span className="icons" style={{ display: "block", textAlign: "center", fontSize: "1.3em" }}>🏴‍☠️🏴‍☠️🏴‍☠️</span>
          It uses Jackett API to search for torrents on 1337x, RARBG, etc.
          <span className="icons" style={{ display: "block", textAlign: "center", fontSize: "1.3em" }}>🏴‍☠️🏴‍☠️🏴‍☠️</span>
        </p>
      </footer>
    </>
  );
}
