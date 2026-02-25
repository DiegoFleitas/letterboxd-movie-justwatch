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
  movieProviders: TileProvider[];
  poster?: string | null;
}

export interface TileState {
  movieTiles: Record<string, TileData>;
  streamingProviders: Record<string, TileProvider & { urls?: string[] }>;
}

export interface MergeData {
  link?: string;
  poster?: string | null;
  movieProviders?: TileProvider[];
}

export function normalizeId(title: string, year: string | number | null): string {
  return `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;
}

export function mergeTileState(
  prev: TileState,
  title: string,
  year: string | number | null,
  data?: MergeData | null
): TileState {
  const { movieTiles: prevTiles, streamingProviders: prevProviders } = prev;
  const id = normalizeId(title, year);
  const linkToMatch = data?.link
    ? data.link.startsWith("http")
      ? data.link
      : `https://letterboxd.com${data.link}`
    : null;

  let existingId = id;
  const tiles = { ...prevTiles };

  if (prevTiles[id]) {
    existingId = id;
  } else if (linkToMatch) {
    for (const [stateId, tileData] of Object.entries(prevTiles)) {
      if (tileData.link === linkToMatch) {
        existingId = stateId;
        if (stateId !== id) {
          tiles[id] = { ...tileData, id };
          delete tiles[stateId];
        }
        break;
      }
    }
  }

  const existing = tiles[existingId];
  const tileData: TileData = {
    id: existingId,
    title,
    year: existing?.year ?? year ?? undefined,
    link: data?.link ?? existing?.link ?? "",
    movieProviders: Object.prototype.hasOwnProperty.call(data ?? {}, "movieProviders")
      ? (data!.movieProviders ?? [])
      : (existing?.movieProviders ?? []),
    poster:
      data?.poster && data.poster !== "/movie_placeholder.svg"
        ? data.poster
        : data?.poster && !existing?.poster
          ? data.poster
          : existing?.poster ?? null,
  };
  if (data?.link && !tileData.link) tileData.link = data.link;
  if (!tileData.year) tileData.year = year;

  tiles[existingId] = tileData;

  const providers = { ...prevProviders };
  if (data?.movieProviders?.length) {
    for (const provider of data.movieProviders) {
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
  }

  return { movieTiles: tiles, streamingProviders: providers };
}

export function getTileProviderNames(tileData: TileData | null | undefined): string[] {
  return (tileData?.movieProviders ?? []).map((p) => p.name);
}

export function tileMatchesFilter(
  tileData: TileData | null | undefined,
  activeProviderNames: string[] | null | undefined
): boolean {
  if (!activeProviderNames?.length) return true;
  const names = getTileProviderNames(tileData);
  if (!names.length) return false;
  return activeProviderNames.some((n) => names.includes(n));
}
