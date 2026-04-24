import React, { useState, useEffect, useRef, useCallback } from "react";
import type { SubmitEventHandler } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { INTERACTION_FAST_S, motionTransition, TMDB_DEBOUNCE_MS } from "./animation/timing";
import { useAppState } from "./AppStateContext";
import { countries, genres } from "./consts";
import { CountrySelector } from "./CountrySelector";
import { fetchCountryFromIp } from "./countryGeo";
import { SimpleWaitDots } from "./SimpleWaitDots";
import { HTTP_API_PATHS } from "@server/routes";
import { WaitCue } from "./WaitCue";

const COUNTRY_STORAGE_KEY = "letterboxd-justwatch-country";
const FALLBACK_COUNTRY_ID = "en_US";

/** Only ids present in `countries` may be persisted or read from storage. */
function countryIdAllowedForStorage(id: string): string | null {
  return countries.some((c: { id: string }) => c.id === id) ? id : null;
}

function getStoredCountryId(): string | null {
  try {
    const id = localStorage.getItem(COUNTRY_STORAGE_KEY);
    return id ? countryIdAllowedForStorage(id) : null;
  } catch {
    // ignore
  }
  return null;
}

// TMDB debounce now provided by animation/timing.ts
const TMDB_MIN_LENGTH = 2;
const TMDB_MAX_SUGGESTIONS = 8;
const MOVIE_SUGGESTIONS_ID = "movie-suggestions";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setDebouncedValue(value);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
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
  if (!genres?.length) return "";
  const names = (genreIds || [])
    .map((id: number) => genres.find((g: { id: number }) => g.id === id)?.name)
    .filter(Boolean)
    .slice(0, 3);
  return names.join(", ");
}

function yearFromTmdbReleaseDate(releaseDate: string | undefined): string {
  if (!releaseDate) return "";
  return releaseDate.slice(0, 4);
}

function getDefaultCountryId(): string {
  const stored = getStoredCountryId();
  return (
    stored ??
    countries.find((c: { id: string }) => c.id === FALLBACK_COUNTRY_ID)?.id ??
    countries[0]?.id ??
    ""
  );
}

function resolveAllowedCountryId(id: string): string {
  if (countries.some((c: { id: string }) => c.id === id)) return id;
  return getDefaultCountryId();
}

type MovieSuggestionKeyNavContext = {
  suggestions: TMDBMovie[];
  suggestionsOpen: boolean;
  highlightedIndex: number;
  setSuggestionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  pickSuggestion: (movie: TMDBMovie) => void;
};

/** Keeps keyboard navigation logic out of `LeftPanel` for lower cognitive complexity. */
function handleMovieSuggestionKeyDown(
  e: React.KeyboardEvent,
  ctx: MovieSuggestionKeyNavContext,
): void {
  if (!ctx.suggestions.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!ctx.suggestionsOpen) ctx.setSuggestionsOpen(true);
    ctx.setHighlightedIndex((prev) => (prev + 1 + ctx.suggestions.length) % ctx.suggestions.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!ctx.suggestionsOpen) ctx.setSuggestionsOpen(true);
    ctx.setHighlightedIndex((prev) =>
      prev < 0
        ? ctx.suggestions.length - 1
        : (prev - 1 + ctx.suggestions.length) % ctx.suggestions.length,
    );
  } else if (e.key === "Enter" && ctx.suggestionsOpen && ctx.highlightedIndex >= 0) {
    e.preventDefault();
    ctx.pickSuggestion(ctx.suggestions[ctx.highlightedIndex]);
  }
}

function useLeftPanelCountry(): { country: string; handleCountryChange: (id: string) => void } {
  const [country, setCountry] = useState(() => getDefaultCountryId());

  const handleCountryChange = useCallback((id: string): void => {
    const safe = resolveAllowedCountryId(id);
    setCountry(safe);
    const storable = countryIdAllowedForStorage(safe);
    if (storable === null) return;
    try {
      localStorage.setItem(COUNTRY_STORAGE_KEY, storable);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (getStoredCountryId() !== null) return;
    let cancelled = false;
    fetchCountryFromIp(countries).then((id: string | null) => {
      if (!cancelled && id && countries.some((c: { id: string }) => c.id === id)) setCountry(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { country, handleCountryChange };
}

function useTmdbMovieSearchSuggestions(
  debouncedTitle: string,
  movieInputRef: React.RefObject<HTMLInputElement | null>,
  setSuggestions: React.Dispatch<React.SetStateAction<TMDBMovie[]>>,
  setSuggestionsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setSuggestionsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>,
): void {
  useEffect(() => {
    if (debouncedTitle.length < TMDB_MIN_LENGTH) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    const ac = new AbortController();
    setSuggestionsLoading(true);
    const query = encodeURIComponent(debouncedTitle.trim());
    fetch(
      `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/search/movie?query=${query}`,
      {
        signal: ac.signal,
      },
    )
      .then((res) => res.json())
      .then((data: { results?: TMDBMovie[] }) => {
        const results = (data.results || []).slice(0, TMDB_MAX_SUGGESTIONS);
        setSuggestions(results);
        setHighlightedIndex(-1);
        if (movieInputRef.current === document.activeElement) {
          setSuggestionsOpen(true);
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setSuggestions([]);
      })
      .finally(() => setSuggestionsLoading(false));
    return () => ac.abort();
  }, [
    debouncedTitle,
    movieInputRef,
    setSuggestions,
    setSuggestionsOpen,
    setSuggestionsLoading,
    setHighlightedIndex,
  ]);
}

function useCloseSuggestionsOnOutsideClick(
  typeaheadRef: React.RefObject<HTMLDivElement | null>,
  setSuggestionsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>,
): void {
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (typeaheadRef.current && !typeaheadRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeaheadRef, setSuggestionsOpen, setHighlightedIndex]);
}

interface LeftPanelMovieTabProps {
  movieTitle: string;
  setMovieTitle: React.Dispatch<React.SetStateAction<string>>;
  movieYear: string;
  setMovieYear: React.Dispatch<React.SetStateAction<string>>;
  typeaheadRef: React.RefObject<HTMLDivElement | null>;
  movieInputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: TMDBMovie[];
  suggestionsOpen: boolean;
  suggestionsLoading: boolean;
  highlightedIndex: number;
  setSuggestionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  pickSuggestion: (movie: TMDBMovie) => void;
  isMovieSearchLoading: boolean;
}

function LeftPanelMovieTab(props: Readonly<LeftPanelMovieTabProps>): React.ReactElement {
  const {
    movieTitle,
    setMovieTitle,
    movieYear,
    setMovieYear,
    typeaheadRef,
    movieInputRef,
    suggestions,
    suggestionsOpen,
    suggestionsLoading,
    highlightedIndex,
    setSuggestionsOpen,
    setHighlightedIndex,
    onSubmit,
    pickSuggestion,
    isMovieSearchLoading,
  } = props;
  return (
    <motion.form
      key="movie"
      id="movie-form"
      className={`tab-pane is-active`}
      data-testid="movie-form"
      onSubmit={onSubmit}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0, transition: motionTransition(INTERACTION_FAST_S) }}
      exit={{ opacity: 0, x: 8, transition: motionTransition(INTERACTION_FAST_S) }}
    >
      <h3>Search a specific movie...</h3>
      <label htmlFor="movie-input">Movie Title:</label>
      <div
        ref={typeaheadRef}
        className={`twitter-typeahead${suggestionsLoading ? " twitter-typeahead--loading" : ""}`}
      >
        <input
          ref={movieInputRef}
          type="text"
          id="movie-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen}
          aria-controls={MOVIE_SUGGESTIONS_ID}
          aria-activedescendant={
            suggestionsOpen && highlightedIndex >= 0
              ? `${MOVIE_SUGGESTIONS_ID}-option-${highlightedIndex}`
              : undefined
          }
          placeholder="Jurassic Park"
          required
          data-testid="movie-input"
          value={movieTitle}
          onChange={(e) => {
            setMovieTitle(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
          onKeyDown={(e) =>
            handleMovieSuggestionKeyDown(e, {
              suggestions,
              suggestionsOpen,
              highlightedIndex,
              setSuggestionsOpen,
              setHighlightedIndex,
              pickSuggestion,
            })
          }
          autoComplete="off"
        />
        {suggestionsLoading && (
          <>
            <span className="typeahead-loading" aria-hidden="true">
              <SimpleWaitDots variant="muted" />
            </span>
            <span className="sr-only" aria-live="polite">
              Loading movie suggestions
            </span>
          </>
        )}
        {suggestionsOpen && suggestions.length > 0 && (
          <fieldset
            id={MOVIE_SUGGESTIONS_ID}
            className="tt-menu movie-suggestions movie-suggestions-fieldset"
          >
            <legend className="sr-only">Movie title suggestions</legend>
            {suggestions.map((movie, idx) => (
              <button
                key={movie.id}
                type="button"
                id={`${MOVIE_SUGGESTIONS_ID}-option-${idx}`}
                className={`tt-suggestion${highlightedIndex === idx ? " tt-cursor" : ""}`}
                onClick={() => pickSuggestion(movie)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickSuggestion(movie);
                  }
                }}
                tabIndex={-1}
                aria-current={highlightedIndex === idx ? "true" : undefined}
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
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <input type="hidden" id="title" name="title" value={movieTitle} readOnly />
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
        <button
          type="submit"
          className={`btn btn-primary${isMovieSearchLoading ? " btn-with-wait" : ""}`}
          data-testid="movie-submit"
          disabled={isMovieSearchLoading}
        >
          {isMovieSearchLoading ? (
            <>
              <SimpleWaitDots variant="on-accent" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </button>
      </div>
    </motion.form>
  );
}

interface LeftPanelListTabProps {
  listUrl: string;
  setListUrl: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  isListLoading: boolean;
}

function LeftPanelListTab(props: Readonly<LeftPanelListTabProps>): React.ReactElement {
  const { listUrl, setListUrl, onSubmit, isListLoading } = props;
  return (
    <motion.form
      key="list"
      id="letterboxd-form"
      className={`tab-pane is-active`}
      data-testid="list-form"
      onSubmit={onSubmit}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0, transition: motionTransition(INTERACTION_FAST_S) }}
      exit={{ opacity: 0, x: -8, transition: motionTransition(INTERACTION_FAST_S) }}
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
          <button
            type="submit"
            className={`btn btn-primary${isListLoading ? " btn-with-wait" : ""}`}
            data-testid="list-submit"
            disabled={isListLoading}
          >
            {isListLoading ? (
              <>
                <WaitCue size="sm" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>
    </motion.form>
  );
}

export function LeftPanel(): React.ReactElement {
  const {
    loadLetterboxdList,
    submitMovieSearch,
    activeTab,
    setActiveTab,
    isMovieSearchLoading,
    isListLoading,
    registerListFormDevBridge,
  } = useAppState();
  const { country, handleCountryChange } = useLeftPanelCountry();

  const [movieTitle, setMovieTitle] = useState("");
  const [movieYear, setMovieYear] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [suggestions, setSuggestions] = useState<TMDBMovie[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const typeaheadRef = useRef<HTMLDivElement>(null);
  const movieInputRef = useRef<HTMLInputElement>(null);

  const debouncedTitle = useDebounce(movieTitle, TMDB_DEBOUNCE_MS);

  useTmdbMovieSearchSuggestions(
    debouncedTitle,
    movieInputRef,
    setSuggestions,
    setSuggestionsOpen,
    setSuggestionsLoading,
    setHighlightedIndex,
  );

  useCloseSuggestionsOnOutsideClick(typeaheadRef, setSuggestionsOpen, setHighlightedIndex);

  const pickSuggestion = (movie: TMDBMovie): void => {
    setMovieTitle(movie.title);
    setMovieYear(yearFromTmdbReleaseDate(movie.release_date));
    setSuggestionsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    movieInputRef.current?.blur();
  };

  const handleMovieSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    submitMovieSearch?.({ title: movieTitle, year: movieYear, country });
  };

  const handleListSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    loadLetterboxdList?.(listUrl.trim(), country);
  };

  useEffect(() => {
    registerListFormDevBridge({ setListUrl, getCountryId: () => country });
    return () => {
      registerListFormDevBridge(null);
    };
  }, [country, registerListFormDevBridge, setListUrl]);

  return (
    <article>
      <header className="panel-masthead">
        <p className="panel-masthead__eyebrow">Letterboxd · streaming by country</p>
        <h1 className="panel-masthead__title">Movie JustWatch</h1>
      </header>
      <div className="country-selector-container global-country-selector">
        <CountrySelector value={country} onChange={handleCountryChange} />
      </div>
      <div className="search-tabs">
        <motion.button
          type="button"
          className={`tab-btn ${activeTab === "movie" ? "active" : ""}`}
          id="tab-movie"
          data-testid="tab-movie"
          onClick={() => setActiveTab("movie")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.995 }}
          transition={motionTransition(INTERACTION_FAST_S)}
        >
          <span className="tab-btn-icon" aria-hidden>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 9l5 3-5 3V9z" />
            </svg>
          </span>
          {"Movie"}
        </motion.button>
        <motion.button
          type="button"
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          id="tab-list"
          data-testid="tab-list"
          onClick={() => setActiveTab("list")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.995 }}
          transition={motionTransition(INTERACTION_FAST_S)}
        >
          <span className="tab-btn-icon" aria-hidden>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </span>
          {"List"}
        </motion.button>
      </div>
      <div className="tab-content active-section">
        <AnimatePresence mode="wait">
          {activeTab === "movie" ? (
            <LeftPanelMovieTab
              movieTitle={movieTitle}
              setMovieTitle={setMovieTitle}
              movieYear={movieYear}
              setMovieYear={setMovieYear}
              typeaheadRef={typeaheadRef}
              movieInputRef={movieInputRef}
              suggestions={suggestions}
              suggestionsOpen={suggestionsOpen}
              suggestionsLoading={suggestionsLoading}
              highlightedIndex={highlightedIndex}
              setSuggestionsOpen={setSuggestionsOpen}
              setHighlightedIndex={setHighlightedIndex}
              onSubmit={handleMovieSubmit}
              pickSuggestion={pickSuggestion}
              isMovieSearchLoading={isMovieSearchLoading}
            />
          ) : (
            <LeftPanelListTab
              listUrl={listUrl}
              setListUrl={setListUrl}
              onSubmit={handleListSubmit}
              isListLoading={isListLoading}
            />
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
