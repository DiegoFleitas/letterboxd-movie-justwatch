import { useCallback, useRef } from "react";
import { showMessage } from "./showMessage";
import type { MergeData } from "./movieTiles";

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
    link: response.link ?? "",
    movieProviders: response.movieProviders ?? [],
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
          if (response.status === 502) console.error(response);
          return response.json();
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
        .catch((err) => console.error(err))
        .finally(() => {
          isInFlightRef.current = false;
          setMovieSearchLoading?.(false);
        });
    },
    [mergeTile, setShowAltSearchButton, setMovieSearchLoading],
  );
  return submitMovieSearch;
}
