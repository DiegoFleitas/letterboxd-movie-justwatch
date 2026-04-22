import { useCallback, useRef } from "react";
import { showMessage } from "./showMessage";
import { PLACEHOLDER_POSTER, normalizePosterPath, type MergeData } from "./movieTiles";
import { captureFrontendException, captureFrontendMessage } from "./sentry";
import { SafeJsonResponseError, safeJsonResponse } from "./safeJsonResponse";

export interface MovieSearchResponse {
  error?: string;
  title?: string;
  year?: string | number;
  message?: string;
  poster?: string;
  link?: string;
  imdbLink?: string;
  tmdbLink?: string;
  movieProviders?: { id: string; name: string; icon?: string; url: string }[];
}

type MergeTileFn = (
  title: string,
  year: string | number | null,
  data: MergeData | null | undefined,
) => void;

export function buildMovieMergeData(response: MovieSearchResponse): MergeData {
  const normalizedPoster = normalizePosterPath(response.poster);
  return {
    poster: normalizedPoster ?? PLACEHOLDER_POSTER,
    ...(response.link !== undefined ? { link: response.link } : {}),
    ...(response.imdbLink !== undefined ? { imdbLink: response.imdbLink } : {}),
    ...(response.tmdbLink !== undefined ? { tmdbLink: response.tmdbLink } : {}),
    ...(response.movieProviders !== undefined ? { movieProviders: response.movieProviders } : {}),
  };
}

export function useMovieSearch(
  setShowAltSearchButton?: ((show: boolean) => void) | null,
  setMovieSearchLoading?: ((loading: boolean) => void) | null,
  mergeTile?: MergeTileFn | null,
): (data: { title?: string; year?: string | number; country?: string }) => void {
  const isInFlightRef = useRef(false);
  const submitMovieSearch = useCallback(
    (data: { title?: string; year?: string | number; country?: string }) => {
      if (isInFlightRef.current) {
        showMessage("Already working on that search...");
        return;
      }
      isInFlightRef.current = true;
      setMovieSearchLoading?.(true);
      fetch("/api/search-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((response) => {
          setShowAltSearchButton?.(true);
          if (response.status >= 500) {
            captureFrontendMessage("search-movie upstream error", {
              tags: { source: "api", endpoint: "/api/search-movie", reason: "http-5xx" },
              extra: { status: response.status, title: data.title, year: data.year },
            });
            console.error(response);
          }
          return safeJsonResponse<MovieSearchResponse>(response);
        })
        .then((response: MovieSearchResponse) => {
          const { error, title, year, message, movieProviders } = response;
          if (title) {
            mergeTile?.(title, year ?? null, buildMovieMergeData(response));
          }
          if (error) {
            showMessage(`[${title} (${year})] ${error}`);
          } else {
            const names = (movieProviders ?? []).map((e) => e.name).join(", ");
            showMessage(`[${title} (${year})] ${message ?? ""}: ${names}`);
          }
        })
        .catch((err) => {
          if (err instanceof SafeJsonResponseError) {
            captureFrontendMessage("search-movie parse failure", {
              tags: {
                source: "api",
                endpoint: "/api/search-movie",
                reason: err.kind,
              },
              extra: {
                status: err.status,
                bodySnippet: err.bodySnippet,
                title: data.title,
                year: data.year,
                country: data.country,
              },
            });
          }
          captureFrontendException(err, {
            tags: { source: "api", endpoint: "/api/search-movie" },
            extra: { title: data.title, year: data.year, country: data.country },
          });
          console.error(err);
        })
        .finally(() => {
          isInFlightRef.current = false;
          setMovieSearchLoading?.(false);
        });
    },
    [mergeTile, setShowAltSearchButton, setMovieSearchLoading],
  );
  return submitMovieSearch;
}
