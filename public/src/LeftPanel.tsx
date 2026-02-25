import React, { useState, useEffect, useRef } from "react";
import { useAppState } from "./AppStateContext";
import { countries, generes } from "./consts";
import { CountrySelector } from "./CountrySelector";
import { fetchCountryFromIp } from "./countryGeo";

const COUNTRY_STORAGE_KEY = "letterboxd-justwatch-country";
const FALLBACK_COUNTRY_ID = "en_US";

function getStoredCountryId(): string | null {
  try {
    const id = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (id && countries.some((c: { id: string }) => c.id === id)) return id;
  } catch {
    // ignore
  }
  return null;
}

const TMDB_DEBOUNCE_MS = 120;
const TMDB_MIN_LENGTH = 2;
const TMDB_MAX_SUGGESTIONS = 8;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

interface TMDBMovie {
  id: number;
  title: string;
  release_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
}

function getGenreNames(genreIds: number[] | undefined): string {
  if (!generes?.length) return "";
  const names = (genreIds || [])
    .map((id: number) => generes.find((g: { id: number }) => g.id === id)?.name)
    .filter(Boolean)
    .slice(0, 3);
  return names.join(", ");
}

export function LeftPanel(): React.ReactElement {
  const { showAltSearchButton, loadLetterboxdList, submitMovieSearch, runAlternativeSearch } =
    useAppState();
  const [activeTab, setActiveTab] = useState("movie");
  const [country, setCountryState] = useState(() => {
    const stored = getStoredCountryId();
    return stored ?? countries.find((c: { id: string }) => c.id === FALLBACK_COUNTRY_ID)?.id ?? countries[0]?.id ?? "";
  });

  const setCountry = (id: string): void => {
    setCountryState(id);
    try {
      localStorage.setItem(COUNTRY_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (getStoredCountryId() !== null) return;
    let cancelled = false;
    fetchCountryFromIp(countries).then((id: string | null) => {
      if (!cancelled && id) setCountryState(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [movieTitle, setMovieTitle] = useState("");
  const [movieYear, setMovieYear] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [suggestions, setSuggestions] = useState<TMDBMovie[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const typeaheadRef = useRef<HTMLDivElement>(null);
  const movieInputRef = useRef<HTMLInputElement>(null);

  const debouncedTitle = useDebounce(movieTitle, TMDB_DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedTitle.length < TMDB_MIN_LENGTH) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const ac = new AbortController();
    setSuggestionsLoading(true);
    const query = encodeURIComponent(debouncedTitle.trim());
    fetch(`/api/proxy/https://api.themoviedb.org/3/search/movie?query=${query}`, {
      signal: ac.signal,
    })
      .then((res) => res.json())
      .then((data: { results?: TMDBMovie[] }) => {
        const results = (data.results || []).slice(0, TMDB_MAX_SUGGESTIONS);
        setSuggestions(results);
        if (movieInputRef.current === document.activeElement) {
          setSuggestionsOpen(true);
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setSuggestions([]);
      })
      .finally(() => setSuggestionsLoading(false));
    return () => ac.abort();
  }, [debouncedTitle]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (typeaheadRef.current && !typeaheadRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pickSuggestion = (movie: TMDBMovie): void => {
    setMovieTitle(movie.title);
    setMovieYear(movie.release_date ? movie.release_date.slice(0, 4) : "");
    setSuggestionsOpen(false);
    setSuggestions([]);
    movieInputRef.current?.blur();
  };

  const handleMovieSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    submitMovieSearch?.({ title: movieTitle, year: movieYear, country });
  };

  const handleListSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    loadLetterboxdList?.(listUrl.trim(), country);
  };

  const handleAlternativeSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    runAlternativeSearch?.(movieTitle, movieYear);
  };

  return (
    <article>
      <div className="country-selector-container global-country-selector">
        <CountrySelector value={country} onChange={setCountry} />
      </div>
      <div className="search-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "movie" ? "active" : ""}`}
          id="tab-movie"
          data-testid="tab-movie"
          onClick={() => setActiveTab("movie")}
        >
          <span className="tab-btn-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 9l5 3-5 3V9z" />
            </svg>
          </span>
          Movie
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          id="tab-list"
          data-testid="tab-list"
          onClick={() => setActiveTab("list")}
        >
          <span className="tab-btn-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </span>
          List
        </button>
      </div>
      <div className="tab-content active-section">
        <form
          id="movie-form"
          className={`tab-pane ${activeTab === "movie" ? "is-active" : ""}`}
          data-testid="movie-form"
          onSubmit={handleMovieSubmit}
        >
          <h3>Search a specific movie...</h3>
          <label htmlFor="movie-input">Movie Title:</label>
          <div ref={typeaheadRef} className="twitter-typeahead">
            <input
              ref={movieInputRef}
              type="text"
              id="movie-input"
              placeholder="Jurassic Park"
              required
              data-testid="movie-input"
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
              onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
              autoComplete="off"
            />
            {suggestionsLoading && (
              <span className="typeahead-loading" aria-hidden="true">…</span>
            )}
            {suggestionsOpen && suggestions.length > 0 && (
              <ul className="tt-menu movie-suggestions">
                {suggestions.map((movie) => (
                  <li
                    key={movie.id}
                    className="tt-suggestion"
                    onClick={() => pickSuggestion(movie)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      (e.preventDefault(), pickSuggestion(movie))
                    }
                    role="button"
                    tabIndex={0}
                  >
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt=""
                        width={44}
                        height={66}
                      />
                    ) : (
                      <div className="typeahead-poster-placeholder" />
                    )}
                    <div>
                      <span className="title">{movie.title}</span>
                      {movie.release_date ? (
                        <span className="meta"> ({movie.release_date.slice(0, 4)})</span>
                      ) : null}
                      {movie.genre_ids?.length ? (
                        <div className="meta">{getGenreNames(movie.genre_ids)}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input type="hidden" id="title" name="title" value={movieTitle} readOnly aria-hidden />
          <label htmlFor="year">Release year:</label>
          <input
            type="text"
            id="year"
            name="year"
            placeholder="1993"
            required
            aria-label="Movie release year input"
            data-testid="movie-year"
            value={movieYear}
            onChange={(e) => setMovieYear(e.target.value)}
          />
          <div className="submit-container">
            <button type="submit" className="btn btn-primary" data-testid="movie-submit">
              Search
            </button>
          </div>
          <button
            type="button"
            className={`alternative-search btn ${showAltSearchButton ? "" : "hide-alternative-search"}`}
            style={{ backgroundColor: "#000" }}
            aria-label="Alternative search button"
            data-testid="alternative-search-btn"
            onClick={handleAlternativeSearch}
          >
            Torrent search 🏴‍☠️
          </button>
        </form>
        <form
          id="letterboxd-form"
          className={`tab-pane ${activeTab === "list" ? "is-active" : ""}`}
          data-testid="list-form"
          onSubmit={handleListSubmit}
        >
          <h3>...or a Letterboxd list</h3>
          <div>
            <div className="url-container">
              <input
                id="list-url"
                name="listUrl"
                type="text"
                placeholder="https://letterboxd.com/username/watchlist/"
                required
                aria-label="Letterboxd list URL input"
                data-testid="list-url"
                value={listUrl}
                onChange={(e) => setListUrl(e.target.value)}
              />
            </div>
            <div className="submit-container">
              <button type="submit" className="btn btn-primary" data-testid="list-submit">
                Submit
              </button>
              {import.meta.env?.DEV && (
                <button
                  type="button"
                  className="btn btn-secondary dev-clear-cache"
                  data-testid="dev-clear-list-cache"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/dev/clear-list-cache", { method: "POST" });
                      const data = (await r.json()) as { cleared?: number; error?: string };
                      if (r.ok) {
                        window.alert(`Cleared ${data.cleared ?? 0} list cache entries.`);
                      } else {
                        window.alert(data.error || "Failed to clear cache");
                      }
                    } catch (e) {
                      window.alert("Failed to clear cache: " + (e as Error).message);
                    }
                  }}
                >
                  Clear list cache (dev)
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </article>
  );
}
