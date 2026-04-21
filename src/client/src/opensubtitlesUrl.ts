const IMDB_TITLE_PATH_RE = /imdb\.com\/title\/(tt\d+)/i;

function imdbNumericForOpenSubtitles(imdbLink: string | undefined): string | null {
  if (!imdbLink) return null;
  const m = imdbLink.match(IMDB_TITLE_PATH_RE);
  if (!m) return null;
  const n = parseInt(m[1].slice(2), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return String(n);
}

/** Browse OpenSubtitles.com for this film (no API key; opens website search). */
export function buildOpenSubtitlesBrowseUrl(
  title: string,
  year?: string | number,
  imdbLink?: string,
): string {
  const imdbId = imdbNumericForOpenSubtitles(imdbLink);
  if (imdbId != null) {
    return `https://www.opensubtitles.com/en/search/sublanguageid-all/imdbid-${imdbId}`;
  }
  const name = title?.trim() || "film";
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : "";
  const moviename = y ? `${name} ${y}` : name;
  return `https://www.opensubtitles.com/en/search/sublanguageid-all/moviename-${encodeURIComponent(moviename)}`;
}
