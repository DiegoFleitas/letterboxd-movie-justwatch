import { getPublicAssetPath } from "./assetPath.js";

export interface TileProvider {
  id: string;
  name: string;
  icon?: string;
  url: string;
  urls?: string[];
}

export interface TileData {
  id: string;
  title: string;
  year?: string | number | null;
  link: string;
  imdbLink?: string;
  tmdbLink?: string;
  movieProviders: TileProvider[];
  poster?: string | null;
}

export interface TileState {
  movieTiles: Record<string, TileData>;
  streamingProviders: Record<string, TileProvider & { urls?: string[] }>;
}

export type SearchTab = "movie" | "list";

export interface TabbedTileState {
  movie: TileState;
  list: TileState;
}

export interface MergeData {
  link?: string;
  imdbLink?: string;
  tmdbLink?: string;
  poster?: string | null;
  movieProviders?: TileProvider[];
}

export type TileYear = string | number | null;

export const PLACEHOLDER_POSTER = getPublicAssetPath("movie_placeholder.svg");
export const LEGACY_PLACEHOLDER_POSTER = "/movie_placeholder.svg";

export function normalizePosterPath(poster: string | null | undefined): string | null | undefined {
  if (poster === LEGACY_PLACEHOLDER_POSTER) return PLACEHOLDER_POSTER;
  return poster;
}

export function isPlaceholderPoster(poster: string | null | undefined): boolean {
  return poster == null || poster === PLACEHOLDER_POSTER || poster === LEGACY_PLACEHOLDER_POSTER;
}

/** After list load + search, used for GitHub issue prefilling when the UI looks broken */
export type ListReportSymptom = "no_tiles" | "all_placeholder_posters";

export function classifyListReportSymptom(
  movieTiles: Record<string, TileData>,
): ListReportSymptom | null {
  const entries = Object.values(movieTiles);
  if (entries.length === 0) return "no_tiles";
  if (entries.every((t) => isPlaceholderPoster(t.poster))) return "all_placeholder_posters";
  return null;
}

function normalizeId(title: string, year: TileYear): string {
  return `${year}-${title.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
}

/** Letterboxd list entries often use root-relative paths; keep absolute URLs for consumers. */
export function normalizeLetterboxdFilmLink(link: string): string {
  if (!link) return "";
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  if (link.startsWith("//")) return `https:${link}`;
  const normalizedPath = link.startsWith("/") ? link : `/${link}`;
  return `https://letterboxd.com${normalizedPath}`;
}

/** Film page when `link` is set; otherwise Letterboxd title search. */
export function letterboxdFilmUrlOrSearchUrl(link: string, title: string, year?: TileYear): string {
  const trimmed = link?.trim() ?? "";
  if (trimmed) return normalizeLetterboxdFilmLink(trimmed);
  const q = year != null && year !== "" ? `${title} ${year}` : title;
  return `https://letterboxd.com/search/${encodeURIComponent(q)}/`;
}

function resolveTileId(
  tiles: Record<string, TileData>,
  id: string,
  linkToMatch: string | null,
): string {
  if (tiles[id]) return id;
  if (linkToMatch) {
    for (const [stateId, tileData] of Object.entries(tiles)) {
      if (tileData.link === linkToMatch) {
        if (stateId !== id) {
          tiles[id] = { ...tileData, id };
          delete tiles[stateId];
        }
        return id;
      }
    }
  }
  return id;
}

function resolveTilePoster(
  incomingPoster: string | null | undefined,
  existingPoster: string | null | undefined,
): string | null {
  if (incomingPoster && (!isPlaceholderPoster(incomingPoster) || !existingPoster)) {
    return incomingPoster;
  }
  return existingPoster ?? null;
}

function mergeStreamingProviders(
  prevProviders: Record<string, TileProvider & { urls?: string[] }>,
  movieProviders: TileProvider[],
): Record<string, TileProvider & { urls?: string[] }> {
  const providers = { ...prevProviders };
  for (const provider of movieProviders) {
    const existingP = providers[provider.id];
    if (existingP) {
      providers[provider.id] = {
        ...existingP,
        urls: [...(existingP.urls ?? []), provider.url],
      };
    } else {
      providers[provider.id] = {
        id: provider.id,
        name: provider.name,
        icon: provider.icon,
        url: provider.url,
        urls: [provider.url],
      };
    }
  }
  return providers;
}

export function mergeTileState(
  prev: TileState,
  title: string,
  year: TileYear,
  data?: MergeData | null,
): TileState {
  const { movieTiles: prevTiles, streamingProviders: prevProviders } = prev;
  const id = normalizeId(title, year);
  const linkToMatch = data?.link?.trim() ? normalizeLetterboxdFilmLink(data.link.trim()) : null;
  const tiles = { ...prevTiles };
  const existingId = resolveTileId(tiles, id, linkToMatch);

  const existing = tiles[existingId];
  const incomingPoster = normalizePosterPath(data?.poster);
  const existingPoster = normalizePosterPath(existing?.poster);
  const rawLink = data?.link ?? existing?.link ?? "";
  const resolvedPoster = resolveTilePoster(incomingPoster, existingPoster);
  const tileData: TileData = {
    id: existingId,
    title,
    year: existing?.year ?? year ?? undefined,
    link: rawLink ? normalizeLetterboxdFilmLink(rawLink) : "",
    imdbLink: data?.imdbLink ?? existing?.imdbLink,
    tmdbLink: data?.tmdbLink ?? existing?.tmdbLink,
    movieProviders: Object.prototype.hasOwnProperty.call(data ?? {}, "movieProviders")
      ? (data!.movieProviders ?? [])
      : (existing?.movieProviders ?? []),
    poster: resolvedPoster,
  };
  if (data?.link && !tileData.link) tileData.link = normalizeLetterboxdFilmLink(data.link);
  if (!tileData.year) tileData.year = year;

  tiles[existingId] = tileData;

  const providers = data?.movieProviders?.length
    ? mergeStreamingProviders(prevProviders, data.movieProviders)
    : { ...prevProviders };

  return { movieTiles: tiles, streamingProviders: providers };
}

export function createInitialTileState(): TileState {
  return { movieTiles: {}, streamingProviders: {} };
}

export function createInitialTabbedTileState(): TabbedTileState {
  return {
    movie: createInitialTileState(),
    list: createInitialTileState(),
  };
}

export function mergeTileStateForTab(
  prev: TabbedTileState,
  tab: SearchTab,
  title: string,
  year: TileYear,
  data?: MergeData | null,
): TabbedTileState {
  return {
    ...prev,
    [tab]: mergeTileState(prev[tab], title, year, data),
  };
}

export function getTileProviderNames(tileData: TileData | null | undefined): string[] {
  return (tileData?.movieProviders ?? []).map((p) => p.name);
}
