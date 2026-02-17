export function normalizeId(title, year) {
  return `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;
}

/**
 * Pure merge: returns new { movieTiles, streamingProviders } without mutating prev.
 */
export function mergeTileState(prev, title, year, data) {
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
  const tileData = {
    id: existingId,
    title,
    year: existing?.year || year,
    link: data?.link ?? existing?.link ?? "",
    movieProviders: data?.hasOwnProperty("movieProviders")
      ? (data.movieProviders ?? [])
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
          urls: [...existingP.urls, provider.url],
        };
      } else {
        providers[provider.id] = {
          id: provider.id,
          name: provider.name,
          icon: provider.icon,
          urls: [provider.url],
        };
      }
    }
  }

  return { movieTiles: tiles, streamingProviders: providers };
}

export function getTileProviderNames(tileData) {
  return (tileData?.movieProviders ?? []).map((p) => p.name);
}

export function tileMatchesFilter(tileData, activeProviderNames) {
  if (!activeProviderNames?.length) return true;
  const names = getTileProviderNames(tileData);
  if (!names.length) return false;
  return activeProviderNames.some((n) => names.includes(n));
}
