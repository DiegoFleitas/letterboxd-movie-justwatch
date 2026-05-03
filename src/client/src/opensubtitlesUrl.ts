const IMDB_TITLE_PATH_RE = /imdb\.com\/title\/(tt\d+)/i;
const TMDB_MOVIE_PATH_RE = /themoviedb\.org\/movie\/(\d+)/i;

function imdbTtFromLink(imdbLink: string | undefined): string | null {
  if (!imdbLink) return null;
  const m = imdbLink.match(IMDB_TITLE_PATH_RE);
  return m ? m[1] : null;
}

function tmdbNumericFromLink(tmdbLink: string | undefined): string | null {
  if (!tmdbLink) return null;
  const m = tmdbLink.match(TMDB_MOVIE_PATH_RE);
  return m ? m[1] : null;
}

function subtitlesSearchUrl(query: string): string {
  const params = new URLSearchParams();
  params.set("query", query);
  return `https://www.opensubtitles.com/en/subtitles?${params.toString()}`;
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
    return subtitlesSearchUrl(`imdb:${tt}`);
  }
  const tmdbId = tmdbNumericFromLink(tmdbLink);
  if (tmdbId != null) {
    return subtitlesSearchUrl(`tmdb:${tmdbId}`);
  }
  const name = title?.trim() || "film";
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : "";
  const searchText = y ? `${name} ${y}` : name;
  return subtitlesSearchUrl(searchText);
}
