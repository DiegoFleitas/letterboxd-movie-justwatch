/**
 * Letterboxd resolves these to the film page when we have no `/film/slug/` URL.
 * Prefer IMDb when both exist (matches historical server behavior).
 */

export function buildLetterboxdImdbBridgeLink(
  imdbId: string | number | null | undefined,
): string | undefined {
  if (!imdbId) return undefined;
  const id = String(imdbId).trim();
  if (!id) return undefined;
  return `https://letterboxd.com/imdb/${id}`;
}

export function buildLetterboxdTmdbBridgeLink(
  tmdbId: string | number | null | undefined,
): string | undefined {
  if (tmdbId == null) return undefined;
  const id = String(tmdbId).trim();
  if (!id) return undefined;
  return `https://letterboxd.com/tmdb/${id}`;
}

export function buildLetterboxdStableFilmLink(
  imdbId: string | number | null | undefined,
  tmdbId: string | number | null | undefined,
): string | undefined {
  return buildLetterboxdImdbBridgeLink(imdbId) ?? buildLetterboxdTmdbBridgeLink(tmdbId);
}
