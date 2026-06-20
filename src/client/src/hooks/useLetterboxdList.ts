import { useRef, useCallback, useEffect, type RefObject } from "react";
import { NOTICE_HOLD_LIST_COMPLETE_MS, NO_POSTER_REPORT_DELAY_MS } from "../animation/timing";
import { buildListGithubIssueUrl, listReportToastCopy } from "../utils/githubIssueUrl";
import { parseLetterboxdListUrl } from "@server/lib/letterboxdListUrl";
import { toggleNotice } from "../utils/noticeFunctions";
import { showError, showBatchErrors, type BatchError } from "../utils/showError";
import { showMessage } from "../utils/showMessage";
import {
  PLACEHOLDER_POSTER,
  classifyListReportSymptom,
  normalizePosterPath,
  type MergeData,
  type TileData,
} from "../utils/movieTiles";
import { HTTP_API_PATHS } from "@server/routes";
import { captureFrontendException } from "../utils/sentry";
import { safeJsonResponse } from "../utils/safeJsonResponse";
import {
  fetchSearchMovie,
  SEARCH_MOVIE_NETWORK_ERROR_MESSAGE,
  SEARCH_MOVIE_TOTAL_ATTEMPTS,
} from "../utils/fetchSearchMovie";
import type {
  PageFilm,
  LetterboxdListResponse,
  SearchMovieResponse,
} from "@server/lib/types/index.js";

const SEARCH_CONCURRENCY_DEFAULT = 4;
export const SEARCH_CONCURRENCY_MOBILE = 2;

/** Max wait for list API (server may chain many outbound Letterboxd fetches). */
const LIST_API_TIMEOUT_MS = 120_000;

export function resolveSearchConcurrency(): number {
  if (typeof navigator !== "undefined" && /Android/i.test(globalThis.navigator.userAgent)) {
    return SEARCH_CONCURRENCY_MOBILE;
  }
  return SEARCH_CONCURRENCY_DEFAULT;
}

function isListFetchTimedOut(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === "AbortError" || e.name === "TimeoutError";
  }
  if (e instanceof Error && e.name === "TimeoutError") {
    return true;
  }
  return false;
}

function fetchLetterboxdPoster(
  posterPath: string,
  title: string,
  year: string | number | null,
  link: string | undefined,
  mergeTile: MergeTileFn | null | undefined,
): void {
  fetch(`https://letterboxd.com${posterPath}poster/std/230/`)
    .then((res) => res.json())
    .then((d: { url?: string }) => d?.url && mergeTile?.(title, year, { poster: d.url, link }))
    .catch(() => {});
}

function runWithConcurrency(tasks: (() => Promise<unknown>)[], limit: number): Promise<void> {
  let index = 0;
  function runNext(): Promise<void> {
    if (index >= tasks.length) return Promise.resolve();
    const i = index++;
    return tasks[i]().then(() => runNext()) as Promise<void>;
  }
  return Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, runNext),
  ) as Promise<unknown> as Promise<void>;
}

function isScrollNearBottom(target: EventTarget): boolean {
  if (target === globalThis) {
    return (
      globalThis.innerHeight + globalThis.scrollY + 100 >= document.documentElement.scrollHeight
    );
  }
  const el = target as HTMLElement;
  return el.scrollTop + el.clientHeight + 100 >= el.scrollHeight;
}

interface LoadData {
  listUrl?: string;
  country?: string;
  username?: string;
  listType?: string;
  page?: number;
}

type MergeTileFn = (title: string, year: string | number | null, data?: MergeData | null) => void;

export function useLetterboxdList(
  mergeTile: MergeTileFn | null | undefined,
  setListLoading?: ((loading: boolean) => void) | null,
  listMovieTilesRef?: RefObject<Record<string, TileData>> | null,
): (listUrl: string, country: string) => Promise<void> {
  const allPagesLoadedRef = useRef(false);
  const watchlistPageCountRef = useRef(0);
  const scrollListenerRef = useRef<((e: Event) => void) | null>(null);
  const scrollContainersRef = useRef<EventTarget[]>([]);
  const isLoadingRef = useRef(false);
  const isSubmittingListRef = useRef(false);
  const dataRef = useRef<LoadData | null>(null);
  const loadWatchlistRef = useRef<((d: LoadData) => Promise<void>) | null>(null);
  const loadCustomListRef = useRef<((d: LoadData) => Promise<void>) | null>(null);
  const batchIdRef = useRef(0);
  const batchMapRef = useRef<
    Map<
      number,
      {
        total: number;
        completed: number;
        errors: BatchError[];
      }
    >
  >(new Map());
  const noPosterReportTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const ensureScrollListener = useCallback(function ensureScrollListener(): void {
    if (scrollListenerRef.current) return;

    const handleScroll = (e: Event): void => {
      if (allPagesLoadedRef.current) {
        const fn = scrollListenerRef.current;
        if (fn) {
          for (const c of scrollContainersRef.current) {
            c.removeEventListener("scroll", fn);
          }
        }
        scrollListenerRef.current = null;
        scrollContainersRef.current = [];
        return;
      }
      if (isLoadingRef.current) return;
      if (!isScrollNearBottom(e.currentTarget as EventTarget)) return;

      const d = dataRef.current;
      if (!d) return;
      isLoadingRef.current = true;
      toggleNotice("Loading more pages...");
      const loadMore =
        d.listType && d.listType !== "watchlist"
          ? loadCustomListRef.current
          : loadWatchlistRef.current;
      (loadMore || (() => Promise.resolve()))(d).finally(() => {
        isLoadingRef.current = false;
      });
    };

    scrollListenerRef.current = handleScroll;
    const rightPanel = document.querySelector(".right-panel");
    scrollContainersRef.current =
      rightPanel && globalThis.innerWidth >= 1024 ? [rightPanel] : [globalThis];
    for (const c of scrollContainersRef.current) {
      c.addEventListener("scroll", handleScroll, { passive: true });
    }
  }, []);

  const processList = useCallback(
    async (data: LoadData, responseData: LetterboxdListResponse): Promise<void> => {
      try {
        const { error, watchlist, lastPage, totalPages, hasMore } = responseData;
        const moreToLoad = hasMore ?? lastPage < totalPages;
        allPagesLoadedRef.current = !moreToLoad;
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

        const scheduleListReportNudge = (): void => {
          if (!allPagesLoadedRef.current || watchlist.length === 0 || !listMovieTilesRef) return;
          clearTimeout(noPosterReportTimeoutRef.current);
          const meta = {
            country: data.country,
            listUrl: data.listUrl,
            listSource: "letterboxd_url" as const,
            lastBatchFilmCount: watchlist.length,
            totalPages,
            lastPage,
          };
          noPosterReportTimeoutRef.current = globalThis.setTimeout(() => {
            noPosterReportTimeoutRef.current = undefined;
            const tiles = listMovieTilesRef.current;
            const symptom = classifyListReportSymptom(tiles);
            if (!symptom) return;
            const issueUrl = buildListGithubIssueUrl({
              symptom,
              country: meta.country,
              listUrl: meta.listUrl,
              listSource: meta.listSource,
              lastBatchFilmCount: meta.lastBatchFilmCount,
              totalPages: meta.totalPages,
              lastPage: meta.lastPage,
              tileCount: Object.keys(tiles).length,
              pageUrl: globalThis.location.href,
              userAgent: navigator.userAgent,
            });
            showMessage({ text: listReportToastCopy(symptom), url: issueUrl }, true);
          }, NO_POSTER_REPORT_DELAY_MS);
        };

        const completeBatchItem = (
          batch: NonNullable<ReturnType<typeof batchMapRef.current.get>>,
        ): void => {
          batch.completed++;
          if (batch.completed === batch.total) {
            showBatchErrors(batch.errors);
            batchMapRef.current.delete(batchId);
            scheduleListReportNudge();
          }
        };

        for (const element of watchlist) {
          let { title, year, poster, link } = element;
          poster = normalizePosterPath(poster) || PLACEHOLDER_POSTER;
          mergeTile?.(title ?? "", year ?? null, { poster, link });
        }

        const createSearchSuccessHandler = (
          batchId: number,
          element: PageFilm,
          enrichPoster: (t: string, y: string | number | null) => void,
        ) => {
          return (response: SearchMovieResponse) => {
            const { error: err, title: t, year: y, poster: p, link: l } = response;
            const batch = batchMapRef.current.get(batchId);
            if (!batch) return;
            const resolvedTitle = t ?? element.title ?? "";
            const resolvedYear = y ?? element.year ?? null;
            if (err) {
              batch.errors.push({
                title: resolvedTitle,
                year: resolvedYear ?? "",
                message: err,
              });
              mergeTile?.(resolvedTitle, resolvedYear, {
                poster: p,
                link: l,
                movieProviders: [],
              });
            } else {
              mergeTile?.(resolvedTitle, resolvedYear, { ...response, link: l });
            }
            enrichPoster(resolvedTitle, resolvedYear);
            completeBatchItem(batch);
          };
        };

        const createSearchErrorHandler = (
          batchId: number,
          element: PageFilm,
          enrichPoster: (t: string, y: string | number | null) => void,
          data: LoadData,
        ) => {
          return (e: Error) => {
            const batch = batchMapRef.current.get(batchId);
            if (batch) {
              batch.errors.push({
                title: element.title ?? "",
                year: element.year ?? "",
                message: SEARCH_MOVIE_NETWORK_ERROR_MESSAGE,
              });
              completeBatchItem(batch);
            }
            enrichPoster(element.title ?? "", element.year ?? null);
            captureFrontendException(e, {
              level: "warning",
              fingerprint: ["list-batch", "search-movie", "network"],
              tags: {
                source: "api",
                endpoint: HTTP_API_PATHS.searchMovie,
                flow: "list-batch",
                retriesExhausted: "true",
                attempts: String(SEARCH_MOVIE_TOTAL_ATTEMPTS),
              },
              extra: {
                title: element.title,
                year: element.year,
                country: data.country,
                listUrl: data.listUrl,
              },
            });
            console.error(e);
          };
        };

        const searchTasks = watchlist.map((element) => {
          const { title, year, posterPath, link } = element;
          const movieData = { title, year, country: data.country ?? "" };
          const enrichPoster = (t: string, y: string | number | null): void => {
            if (posterPath) {
              fetchLetterboxdPoster(posterPath, t, y, link, mergeTile);
            }
          };
          return () =>
            fetchSearchMovie(movieData)
              .then((r) => safeJsonResponse<SearchMovieResponse>(r))
              .then(createSearchSuccessHandler(batchId, element, enrichPoster))
              .catch(createSearchErrorHandler(batchId, element, enrichPoster, data));
        });
        runWithConcurrency(searchTasks, resolveSearchConcurrency());
        const loadedPage = data.page ?? 1;
        data.page = loadedPage + 1;
        dataRef.current = data;
        if (!allPagesLoadedRef.current) {
          toggleNotice(`Loaded page ${loadedPage} of ${totalPages}...`);
          ensureScrollListener();
        } else {
          const loadedMessage =
            totalPages === 1
              ? "Loaded 1 page!"
              : totalPages
                ? `Loaded all ${totalPages} pages!`
                : "Loaded all pages!";
          toggleNotice(loadedMessage);
        }
      } catch (e) {
        captureFrontendException(e, {
          tags: { source: "frontend", flow: "process-list" },
          extra: { listType: data.listType, listUrl: data.listUrl, country: data.country },
        });
        console.error(e);
        toggleNotice(null);
      } finally {
        if (allPagesLoadedRef.current) {
          setTimeout(() => toggleNotice(null), NOTICE_HOLD_LIST_COMPLETE_MS);
        }
      }
    },
    [mergeTile, listMovieTilesRef, ensureScrollListener],
  );

  const loadWatchlist = useCallback(
    async (data: LoadData): Promise<void> => {
      try {
        const response = await fetch(HTTP_API_PATHS.letterboxdWatchlist, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-By": "MovieJustWatch" },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(LIST_API_TIMEOUT_MS),
        });
        const responseData = (await response.json()) as LetterboxdListResponse;
        await processList(data, responseData);
      } catch (e) {
        if (isListFetchTimedOut(e)) {
          captureFrontendException(e, {
            tags: {
              source: "api",
              endpoint: HTTP_API_PATHS.letterboxdWatchlist,
              reason: "timeout",
            },
            extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
          });
          showError(
            "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
          );
          toggleNotice(null);
          return;
        }
        captureFrontendException(e, {
          tags: { source: "api", endpoint: HTTP_API_PATHS.letterboxdWatchlist },
          extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
        });
        throw e;
      }
    },
    [processList],
  );

  loadWatchlistRef.current = loadWatchlist;

  const loadCustomList = useCallback(
    async (data: LoadData): Promise<void> => {
      try {
        const response = await fetch(HTTP_API_PATHS.letterboxdCustomList, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-By": "MovieJustWatch" },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(LIST_API_TIMEOUT_MS),
        });
        const responseData = (await response.json()) as LetterboxdListResponse;
        if (!response.ok) {
          showError(responseData.error ?? "Failed to load list");
          return;
        }
        if ((responseData.watchlist?.length ?? 0) === 0) {
          showError("No films found on this list.");
          return;
        }
        await processList(data, responseData);
      } catch (e) {
        if (isListFetchTimedOut(e)) {
          captureFrontendException(e, {
            tags: {
              source: "api",
              endpoint: HTTP_API_PATHS.letterboxdCustomList,
              reason: "timeout",
            },
            extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
          });
          showError(
            "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
          );
          toggleNotice(null);
          return;
        }
        captureFrontendException(e, {
          tags: { source: "api", endpoint: HTTP_API_PATHS.letterboxdCustomList },
          extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
        });
        throw e;
      }
    },
    [processList],
  );

  loadCustomListRef.current = loadCustomList;

  const loadLetterboxdList = useCallback(
    async (listUrl: string, country: string): Promise<void> => {
      if (isSubmittingListRef.current) {
        toggleNotice("Already working on that list...");
        return;
      }
      clearTimeout(noPosterReportTimeoutRef.current);
      noPosterReportTimeoutRef.current = undefined;
      isSubmittingListRef.current = true;
      setListLoading?.(true);
      if (!listUrl?.trim()) {
        showError("Please enter a valid Letterboxd list URL");
        isSubmittingListRef.current = false;
        setListLoading?.(false);
        return;
      }
      try {
        const parsed = parseLetterboxdListUrl(listUrl);
        if (parsed) {
          const data: LoadData = {
            listUrl: parsed.listUrl,
            country,
            username: parsed.username,
            listType: parsed.listType,
            page: 1,
          };
          batchMapRef.current.clear();
          toggleNotice(`Scraping ${parsed.listType} for ${parsed.username}...`);
          if (parsed.listType !== "watchlist") {
            await loadCustomList(data);
          } else {
            await loadWatchlist(data);
          }
          return;
        }
        showError("Invalid Letterboxd list URL. Use a watchlist or custom list URL.");
      } finally {
        isSubmittingListRef.current = false;
        setListLoading?.(false);
      }
    },
    [loadCustomList, loadWatchlist, setListLoading],
  );

  useEffect(() => {
    const batchMap = batchMapRef.current;
    return () => {
      const fn = scrollListenerRef.current;
      if (fn) {
        for (const c of scrollContainersRef.current) {
          c.removeEventListener("scroll", fn);
        }
      }
      scrollListenerRef.current = null;
      scrollContainersRef.current = [];
      batchMap.clear();
      clearTimeout(noPosterReportTimeoutRef.current);
      noPosterReportTimeoutRef.current = undefined;
    };
  }, []);

  return loadLetterboxdList;
}
