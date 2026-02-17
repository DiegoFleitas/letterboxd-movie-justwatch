import { useState, useEffect, useRef } from "react";
import { useAppState } from "./AppStateContext.jsx";
import { countries, generes } from "./consts.js";

const TMDB_DEBOUNCE_MS = 120;
const TMDB_MIN_LENGTH = 2;
const TMDB_MAX_SUGGESTIONS = 8;

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function getGenreNames(genreIds) {
  if (!generes?.length) return "";
  const names = (genreIds || [])
    .map((id) => generes.find((g) => g.id === id)?.name)
    .filter(Boolean)
    .slice(0, 3);
  return names.join(", ");
}

export function LeftPanel() {
  const { showAltSearchButton, loadLetterboxdList, submitMovieSearch, runAlternativeSearch } = useAppState();
  const [activeTab, setActiveTab] = useState("movie");
  const [country, setCountry] = useState(() => {
    const selected = countries.find((c) => c.selected);
    return selected?.id ?? countries[0]?.id ?? "";
  });
  const [movieTitle, setMovieTitle] = useState("");
  const [movieYear, setMovieYear] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const typeaheadRef = useRef(null);
  const movieInputRef = useRef(null);

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
      .then((data) => {
        const results = (data.results || []).slice(0, TMDB_MAX_SUGGESTIONS);
        setSuggestions(results);
        if (movieInputRef.current === document.activeElement) {
          setSuggestionsOpen(true);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setSuggestions([]);
      })
      .finally(() => setSuggestionsLoading(false));
    return () => ac.abort();
  }, [debouncedTitle]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (typeaheadRef.current && !typeaheadRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pickSuggestion = (movie) => {
    setMovieTitle(movie.title);
    setMovieYear(movie.release_date ? movie.release_date.slice(0, 4) : "");
    setSuggestionsOpen(false);
    setSuggestions([]);
    movieInputRef.current?.blur();
  };

  const handleMovieSubmit = (e) => {
    e.preventDefault();
    submitMovieSearch?.({ title: movieTitle, year: movieYear, country });
  };

  const handleListSubmit = (e) => {
    e.preventDefault();
    loadLetterboxdList?.(listUrl.trim(), country);
  };

  const handleAlternativeSearch = (e) => {
    e.preventDefault();
    runAlternativeSearch?.(movieTitle, movieYear);
  };

  return (
    <article>
      <div className="country-selector-container global-country-selector">
        <select
          id="country-global"
          className="country"
          name="country"
          aria-label="User country selection"
          data-testid="country-selector"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.flag} {c.text}
            </option>
          ))}
        </select>
      </div>
      <div className="search-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "movie" ? "active" : ""}`}
          id="tab-movie"
          data-testid="tab-movie"
          onClick={() => setActiveTab("movie")}
        >
          Movie
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          id="tab-list"
          data-testid="tab-list"
          onClick={() => setActiveTab("list")}
        >
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
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pickSuggestion(movie))}
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
          <input type="hidden" id="title" name="title" value={movieTitle} readOnly aria-hidden="true" />
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
            <button type="submit" data-testid="movie-submit">
              Search
            </button>
          </div>
          <button
            type="button"
            className={`alternative-search btn-grad ${showAltSearchButton ? "" : "hide-alternative-search"}`}
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
              <button type="submit" data-testid="list-submit">
                Submit
              </button>
            </div>
          </div>
        </form>
      </div>
    </article>
  );
}
