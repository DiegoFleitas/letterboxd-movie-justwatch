import { useRef, useCallback, useEffect, type RefObject } from "react";
import { NOTICE_HOLD_LIST_COMPLETE_MS, NO_POSTER_REPORT_DELAY_MS } from "./animation/timing";
import { buildListGithubIssueUrl, listReportToastCopy } from "./githubIssueUrl";
import { parseLetterboxdListUrl } from "@server/lib/letterboxdListUrl";
import { toggleNotice } from "./noticeFunctions";
import { showError, showBatchErrors } from "./showError";
import { showMessage } from "./showMessage";
import {
  PLACEHOLDER_POSTER,
  classifyListReportSymptom,
  normalizePosterPath,
  type MergeData,
  type TileData,
} from "./movieTiles";
import { captureFrontendException } from "./sentry";
import { safeJsonResponse } from "./safeJsonResponse";

const SEARCH_CONCURRENCY = 4;

/** Max wait for list API (server may chain many outbound Letterboxd fetches). */
const LIST_API_TIMEOUT_MS = 120_000;

function isListFetchTimedOut(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === "AbortError" || e.name === "TimeoutError";
  }
  if (e instanceof Error && e.name === "TimeoutError") {
    return true;
  }
  return false;
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

type MergeTileFn = (title: string, year: string | number | null, data?: MergeData | null) => void;

export function useLetterboxdList(
  mergeTile: MergeTileFn | null | undefined,
  setListLoading?: ((loading: boolean) => void) | null,
  listMovieTilesRef?: RefObject<Record<string, TileData>> | null,
): (listUrl: string, country: string) => Promise<void> {
  const allPagesLoadedRef = useRef(false);
  const watchlistPageCountRef = useRef(0);
  const scrollListenerRef = useRef<(() => void) | null>(null);
  const isLoadingRef = useRef(false);
  const isSubmittingListRef = useRef(false);
  const dataRef = useRef<LoadData | null>(null);
  const loadWatchlistRef = useRef<((d: LoadData) => Promise<void>) | null>(null);
  const batchIdRef = useRef(0);
  const batchMapRef = useRef<
    Map<
      number,
      {
        total: number;
        completed: number;
        errors: { title?: string; year?: string | number; message: string }[];
      }
    >
  >(new Map());
  const noPosterReportTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
          noPosterReportTimeoutRef.current = window.setTimeout(() => {
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
              pageUrl: window.location.href,
              userAgent: navigator.userAgent,
            });
            showMessage({ text: listReportToastCopy(symptom), url: issueUrl }, true);
          }, NO_POSTER_REPORT_DELAY_MS);
        };

        for (const element of watchlist) {
          let { title, year, posterPath, poster, link } = element;
          poster = normalizePosterPath(poster) || PLACEHOLDER_POSTER;
          mergeTile?.(title ?? "", year ?? null, { poster, link });
          if (posterPath) {
            fetch(`https://letterboxd.com${posterPath}poster/std/230/`)
              .then((res) => res.json())
              .then(
                (d: { url?: string }) =>
                  d?.url && mergeTile?.(title ?? "", year ?? null, { poster: d.url, link }),
              )
              .catch(() => {});
          }
        }
        const searchTasks = watchlist.map((element) => {
          const { title, year } = element;
          const movieData = { title, year, country: data.country ?? "" };
          return () =>
            fetch("/api/search-movie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(movieData),
            })
              .then((r) =>
                safeJsonResponse<{
                  error?: string;
                  title?: string;
                  year?: string | number;
                  poster?: string;
                  link?: string;
                  movieProviders?: unknown[];
                }>(r),
              )
              .then((response) => {
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
                  scheduleListReportNudge();
                }
              })
              .catch((e) => {
                const batch = batchMapRef.current.get(batchId);
                if (batch) {
                  batch.completed++;
                  if (batch.completed === batch.total) {
                    showBatchErrors(batch.errors);
                    batchMapRef.current.delete(batchId);
                    scheduleListReportNudge();
                  }
                }
                captureFrontendException(e, {
                  tags: { source: "api", endpoint: "/api/search-movie", flow: "list-batch" },
                  extra: { title, year, country: data.country, listUrl: data.listUrl },
                });
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
                : "Loaded all pages!",
          );
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
    [mergeTile, listMovieTilesRef],
  );

  const loadWatchlist = useCallback(
    async (data: LoadData): Promise<void> => {
      try {
        const response = await fetch("/api/letterboxd-watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(LIST_API_TIMEOUT_MS),
        });
        const responseData = (await response.json()) as ListResponse;
        await processList(data, responseData);
      } catch (e) {
        if (isListFetchTimedOut(e)) {
          captureFrontendException(e, {
            tags: { source: "api", endpoint: "/api/letterboxd-watchlist", reason: "timeout" },
            extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
          });
          showError(
            "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
          );
          toggleNotice(null);
          return;
        }
        captureFrontendException(e, {
          tags: { source: "api", endpoint: "/api/letterboxd-watchlist" },
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
        const response = await fetch("/api/letterboxd-custom-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(LIST_API_TIMEOUT_MS),
        });
        const responseData = (await response.json()) as ListResponse;
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
            tags: { source: "api", endpoint: "/api/letterboxd-custom-list", reason: "timeout" },
            extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
          });
          showError(
            "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
          );
          toggleNotice(null);
          return;
        }
        captureFrontendException(e, {
          tags: { source: "api", endpoint: "/api/letterboxd-custom-list" },
          extra: { listType: data.listType, listUrl: data.listUrl, page: data.page },
        });
        throw e;
      }
    },
    [processList],
  );

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
    return () => {
      if (scrollListenerRef.current) {
        window.removeEventListener("scroll", scrollListenerRef.current);
      }
      batchMapRef.current.clear();
      clearTimeout(noPosterReportTimeoutRef.current);
      noPosterReportTimeoutRef.current = undefined;
    };
  }, []);

  return loadLetterboxdList;
}
