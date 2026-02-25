import { useRef, useCallback, useEffect } from "react";
import { toggleNotice } from "./noticeFunctions";
import { showError, showBatchErrors } from "./showError";
import type { MergeData } from "./movieTiles";

const MAX_PAGES_PER_LOAD = 20;
const SEARCH_CONCURRENCY = 4;

function runWithConcurrency(tasks: (() => Promise<unknown>)[], limit: number): Promise<void> {
  let index = 0;
  function runNext(): Promise<void> {
    if (index >= tasks.length) return Promise.resolve();
    const i = index++;
    return tasks[i]().then(() => runNext()) as Promise<void>;
  }
  return Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, runNext)
  ) as Promise<unknown> as Promise<void>;
}

interface WatchlistElement {
  title?: string | null;
  year?: string | null;
  link?: string;
  posterPath?: string | null;
  poster?: string | null;
}

interface ListResponse {
  error?: string;
  watchlist: WatchlistElement[];
  lastPage: number;
  totalPages: number;
}

interface LoadData {
  listUrl?: string;
  country?: string;
  username?: string;
  listType?: string;
  page?: number;
}

type MergeTileFn = (
  title: string,
  year: string | number | null,
  data?: MergeData | null
) => void;

export function useLetterboxdList(mergeTile: MergeTileFn | null | undefined): (listUrl: string, country: string) => Promise<void> {
  const allPagesLoadedRef = useRef(false);
  const watchlistPageCountRef = useRef(0);
  const scrollListenerRef = useRef<(() => void) | null>(null);
  const isLoadingRef = useRef(false);
  const dataRef = useRef<LoadData | null>(null);
  const loadWatchlistRef = useRef<((d: LoadData) => Promise<void>) | null>(null);
  const batchIdRef = useRef(0);
  const batchMapRef = useRef<
    Map<
      number,
      { total: number; completed: number; errors: { title?: string; year?: string | number; message: string }[] }
    >
  >(new Map());

  const processList = useCallback(
    async (data: LoadData, responseData: ListResponse): Promise<void> => {
      try {
        const { error, watchlist, lastPage, totalPages } = responseData;
        allPagesLoadedRef.current = lastPage === totalPages;
        watchlistPageCountRef.current = totalPages;
        if (error) {
          showError(error);
          return;
        }
        const batchId = ++batchIdRef.current;
        batchMapRef.current.set(batchId, {
          total: watchlist.length,
          completed: 0,
          errors: [],
        });
        for (const element of watchlist) {
          let { title, year, link, posterPath, poster } = element;
          poster = poster || "/movie_placeholder.svg";
          mergeTile?.(title ?? "", year ?? null, { poster, link });
          if (posterPath) {
            fetch(`https://letterboxd.com${posterPath}poster/std/230/`)
              .then((res) => res.json())
              .then((d: { url?: string }) => d?.url && mergeTile?.(title ?? "", year ?? null, { poster: d.url, link }))
              .catch(() => {});
          }
        }
        const searchTasks = watchlist.map((element) => {
          const { title, year, link } = element;
          const movieData = { title, year, country: data.country ?? "" };
          return () =>
            fetch("/api/search-movie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(movieData),
            })
              .then((r) => r.json())
              .then((response: { error?: string; title?: string; year?: string | number; poster?: string; link?: string; movieProviders?: unknown[] }) => {
                const { error: err, title: t, year: y, poster: p, link: l } = response;
                const batch = batchMapRef.current.get(batchId);
                if (!batch) return;
                batch.completed++;
                if (err) {
                  batch.errors.push({ title: t ?? "", year: y ?? "", message: err });
                  mergeTile?.(t ?? "", y ?? null, { poster: p, link: l, movieProviders: [] });
                } else {
                  mergeTile?.(t ?? "", y ?? null, { ...response, link: l } as MergeData);
                }
                if (batch.completed === batch.total) {
                  showBatchErrors(batch.errors);
                  batchMapRef.current.delete(batchId);
                }
              })
              .catch((e) => {
                const batch = batchMapRef.current.get(batchId);
                if (batch) {
                  batch.completed++;
                  if (batch.completed === batch.total) {
                    showBatchErrors(batch.errors);
                    batchMapRef.current.delete(batchId);
                  }
                }
                console.error(e);
              });
        });
        runWithConcurrency(searchTasks, SEARCH_CONCURRENCY);
        data.page = lastPage;
        dataRef.current = data;
        if (!allPagesLoadedRef.current) {
          toggleNotice(`Loaded page ${data.page} of ${totalPages}...`);
          if (!scrollListenerRef.current) {
            const handleScroll = () => {
              if (allPagesLoadedRef.current) {
                if (scrollListenerRef.current) {
                  window.removeEventListener("scroll", scrollListenerRef.current);
                  scrollListenerRef.current = null;
                }
                return;
              }
              if (
                !isLoadingRef.current &&
                window.innerHeight + window.scrollY + 100 >= document.documentElement.scrollHeight
              ) {
                const d = dataRef.current;
                if (!d) return;
                isLoadingRef.current = true;
                const n = Math.min(
                  watchlistPageCountRef.current - (d.page ?? 0),
                  MAX_PAGES_PER_LOAD
                );
                toggleNotice(`Loading more pages...`);
                (loadWatchlistRef.current || (() => Promise.resolve()))(d).finally(() => {
                  isLoadingRef.current = false;
                });
              }
            };
            scrollListenerRef.current = handleScroll;
            window.addEventListener("scroll", handleScroll, { passive: true });
          }
        } else {
          toggleNotice(
            totalPages === 1
              ? "Loaded 1 page!"
              : totalPages
                ? `Loaded all ${totalPages} pages!`
                : "Loaded all pages!"
          );
        }
      } catch (e) {
        console.error(e);
        toggleNotice(null);
      } finally {
        if (allPagesLoadedRef.current) {
          setTimeout(() => toggleNotice(null), 1500);
        }
      }
    },
    [mergeTile]
  );

  const loadWatchlist = useCallback(
    async (data: LoadData): Promise<void> => {
      const response = await fetch("/api/letterboxd-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const responseData = (await response.json()) as ListResponse;
      await processList(data, responseData);
    },
    [processList]
  );

  loadWatchlistRef.current = loadWatchlist;

  const loadCustomList = useCallback(
    async (data: LoadData): Promise<void> => {
      const response = await fetch("/api/letterboxd-custom-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const responseData = (await response.json()) as ListResponse;
      await processList(data, responseData);
    },
    [processList]
  );

  const loadLetterboxdList = useCallback(
    async (listUrl: string, country: string): Promise<void> => {
      if (!listUrl) {
        showError("Please enter a valid URL");
        return;
      }
      listUrl = listUrl.split("/page")[0];
      if (!listUrl.includes("watchlist") && !listUrl.includes("list"))
        listUrl += "/watchlist";
      if (!listUrl.endsWith("/")) listUrl += "/";
      const match = listUrl.match(
        /https:\/\/letterboxd\.com\/([^/]+)\/(watchlist|list\/[^/]+)\//
      );
      if (!match) {
        showError("Invalid URL format");
        return;
      }
      const username = match[1];
      const listType = match[2].startsWith("list/") ? "custom list" : "watchlist";
      const data: LoadData = {
        listUrl: listUrl.trim(),
        country,
        username,
        listType,
        page: 1,
      };
      batchMapRef.current.clear();
      toggleNotice(`Scraping ${listType} for ${username}...`);
      if (listType !== "watchlist") {
        await loadCustomList(data);
      } else {
        await loadWatchlist(data);
      }
    },
    [loadCustomList, loadWatchlist]
  );

  useEffect(() => {
    return () => {
      if (scrollListenerRef.current) {
        window.removeEventListener("scroll", scrollListenerRef.current);
      }
      batchMapRef.current.clear();
    };
  }, []);

  return loadLetterboxdList;
}
