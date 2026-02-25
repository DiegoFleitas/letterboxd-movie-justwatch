import { useCallback } from "react";
import { showMessage } from "./showMessage";

export function useMovieSearch(
  setShowAltSearchButton?: ((show: boolean) => void) | null
): (data: { title?: string; year?: string | number; country?: string }) => void {
  const submitMovieSearch = useCallback(
    (data: { title?: string; year?: string | number; country?: string }) => {
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
        .then((response: { error?: string; title?: string; year?: string | number; message?: string; movieProviders?: { name: string }[] }) => {
          const { error, title, year, message, movieProviders } = response;
          if (error) {
            showMessage(`[${title} (${year})] ${error}`);
          } else {
            const names = (movieProviders ?? []).map((e) => e.name).join(", ");
            showMessage(`[${title} (${year})] ${message ?? ""}: ${names}`);
          }
        })
        .catch((err) => console.error(err));
    },
    [setShowAltSearchButton]
  );
  return submitMovieSearch;
}
