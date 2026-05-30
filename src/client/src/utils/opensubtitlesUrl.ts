/**
 * OpenSubtitles.com browse URLs for the **website** (no API key).
 *
 * Uses the SPA route shape:
 * `/en/en/search-all/q-{token}/hearing_impaired-include/machine_translated-/trusted_sources-`
 * (see live paths such as `q-tt0065143` for IMDb ids).
 */
const IMDB_TITLE_PATH_RE = /imdb\.com\/title\/(tt\d+)/i;

const SEARCH_ALL_BASE = "https://www.opensubtitles.com/en/en/search-all";
/** Default filter segments after the `q-…` slug (matches site navigation URLs). */
const SEARCH_ALL_TAIL = "/hearing_impaired-include/machine_translated-/trusted_sources-";

function imdbTtFromLink(imdbLink: string | undefined): string | null {
  if (!imdbLink) return null;
  const m = IMDB_TITLE_PATH_RE.exec(imdbLink);
  return m ? m[1] : null;
}

/** TMDB movie URLs always contain `/movie/{numericId}`; locale segments may precede `movie` (e.g. `/es/movie/123`). */
function isTheMovieDbHostname(hostname: string): boolean {
  return hostname === "themoviedb.org" || hostname.endsWith(".themoviedb.org");
}

function tmdbNumericFromLink(tmdbLink: string | undefined): string | null {
  if (!tmdbLink) return null;
  try {
    const { hostname } = new URL(tmdbLink);
    if (!isTheMovieDbHostname(hostname.toLowerCase())) return null;
  } catch {
    return null;
  }
  const m = /\/movie\/(\d+)/i.exec(tmdbLink);
  return m ? m[1] : null;
}

/** `queryToken` becomes the segment after `q-` (encoded for path safety). */
function searchAllBrowseUrl(queryToken: string): string {
  const encoded = encodeURIComponent(queryToken);
  return `${SEARCH_ALL_BASE}/q-${encoded}${SEARCH_ALL_TAIL}`;
}

/** Browse OpenSubtitles.com for this film (no API key; opens website search). */
export function buildOpenSubtitlesBrowseUrl(
  title: string,
  year?: string | number,
  imdbLink?: string,
  tmdbLink?: string,
): string {
  const tt = imdbTtFromLink(imdbLink);
  if (tt != null) {
    return searchAllBrowseUrl(tt);
  }
  const tmdbId = tmdbNumericFromLink(tmdbLink);
  if (tmdbId != null) {
    return searchAllBrowseUrl(`tmdb:${tmdbId}`);
  }
  const name = title?.trim() || "film";
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : "";
  const searchText = y ? `${name} ${y}` : name;
  return searchAllBrowseUrl(searchText);
}
