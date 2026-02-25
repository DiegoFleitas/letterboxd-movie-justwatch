/**
 * Shared types for API and domain models.
 * Used by backend controllers and frontend state.
 */

/** Single streaming provider (JustWatch offer result or frontend state). */
export interface MovieProvider {
  id: string;
  name: string;
  icon?: string;
  url: string;
  urls?: string[];
  type?: string;
}

/** Canonical provider map: technicalName → { id, name }. */
export type CanonicalProviderMap = Record<string, { id: string; name: string }>;

/** One movie tile in app state. */
export interface MovieTileData {
  id: string;
  title: string;
  year: string | number | null;
  link: string;
  movieProviders: MovieProvider[];
  poster: string | null;
}

/** Request body for POST /api/search-movie */
export interface SearchMovieRequestBody {
  title: string;
  year?: string | number;
  country?: string;
}

/** Response from /api/search-movie (success or error). */
export interface SearchMovieResponse {
  message?: string;
  error?: string;
  title: string;
  year?: string | number | null;
  poster?: string | null;
  movieProviders?: MovieProvider[];
}

/** One film from Letterboxd list HTML / API. */
export interface LetterboxdListFilm {
  title: string | null;
  year: string | null;
  link: string;
  posterPath: string | null;
  poster: string | null;
  id?: string | null;
  titleSlug?: string | null;
}

/** Response shape for Letterboxd watchlist/custom list API. */
export interface LetterboxdListResponse {
  error?: string;
  watchlist: LetterboxdListFilm[];
  lastPage: number;
  totalPages: number;
}

/** JustWatch API offer (from GraphQL offers). */
export interface JustWatchOffer {
  monetizationType: string;
  standardWebURL?: string | null;
  package: { technicalName: string; clearName: string; icon: string };
}
