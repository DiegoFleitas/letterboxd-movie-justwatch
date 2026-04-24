import { useCallback, useRef } from "react";
import { HTTP_API_PATHS } from "@server/routes";
import { vi } from "vitest";
import { useLetterboxdList } from "../../useLetterboxdList";
import {
  createInitialTileState,
  mergeTileState,
  type MergeData,
  type TileData,
  type TileState,
} from "../../movieTiles";
import { jsonResponse } from "../jsonResponse";

export const watchlistUrl = "https://letterboxd.com/test-user/watchlist/";
export const customListUrl = "https://letterboxd.com/test-user/list/my-list/";

export function createListAndSearchFetchMock(options: {
  listEndpoint?: string;
  listBody: Record<string, unknown>;
  searchBody?: Record<string, unknown>;
}) {
  const { listEndpoint = HTTP_API_PATHS.letterboxdWatchlist, listBody, searchBody } = options;
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes(listEndpoint)) {
      return Promise.resolve(jsonResponse(listBody));
    }
    if (searchBody && url.includes(HTTP_API_PATHS.searchMovie)) {
      return Promise.resolve(jsonResponse(searchBody));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof globalThis.fetch;
}

export function useLetterboxdListWithMergedTiles() {
  const listMovieTilesRef = useRef<Record<string, TileData>>({});
  const listTileStateRef = useRef<TileState>(createInitialTileState());
  const mergeTile = useCallback(
    (title: string, year: string | number | null, data?: MergeData | null) => {
      const next = mergeTileState(listTileStateRef.current, title, year, data ?? undefined);
      listTileStateRef.current = next;
      listMovieTilesRef.current = next.movieTiles;
    },
    [],
  );
  return useLetterboxdList(mergeTile, undefined, listMovieTilesRef);
}
