import { useCallback, useRef } from "react";
import { showMessage } from "./showMessage";
import type { MergeData } from "./movieTiles";
import { captureFrontendException, captureFrontendMessage } from "./sentry";

export interface MovieSearchResponse {
  error?: string;
  title?: string;
  year?: string | number;
  message?: string;
  poster?: string;
  link?: string;
  movieProviders?: { id: string; name: string; icon?: string; url: string }[];
}

type MergeTileFn = (
  title: string,
  year: string | number | null,
  data: MergeData | null | undefined,
) => void;

export function buildMovieMergeData(response: MovieSearchResponse): MergeData {
  return {
    poster: response.poster ?? "/movie_placeholder.svg",
    ...(response.link !== undefined ? { link: response.link } : {}),
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
          return response.json();
        })
        .then((response: MovieSearchResponse) => {
          const { error, title, year, message, movieProviders } = response;
          if (title) {
            mergeTile?.(title, year ?? null, buildMovieMergeData(response));
          }
          if (error) {
            captureFrontendMessage(error, {
              tags: { source: "api", endpoint: "/api/search-movie", reason: "response-error" },
              extra: { title, year, requestTitle: data.title, requestYear: data.year },
            });
            showMessage(`[${title} (${year})] ${error}`);
          } else {
            const names = (movieProviders ?? []).map((e) => e.name).join(", ");
            showMessage(`[${title} (${year})] ${message ?? ""}: ${names}`);
          }
        })
        .catch((err) => {
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
