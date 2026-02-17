import { useCallback } from "react";
import { showMessage } from "./showMessage.js";

export function useMovieSearch(setShowAltSearchButton) {
  const submitMovieSearch = useCallback(
    (data) => {
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
        .then((response) => {
          const { error, title, year, message, movieProviders } = response;
          if (error) {
            showMessage(`[${title} (${year})] ${error}`);
          } else {
            const names = (movieProviders || []).map((e) => e.name).join(", ");
            showMessage(`[${title} (${year})] ${message}: ${names}`);
          }
        })
        .catch((err) => console.error(err));
    },
    [setShowAltSearchButton]
  );
  return submitMovieSearch;
}
