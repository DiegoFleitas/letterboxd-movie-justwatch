import { useRef, useCallback, useEffect } from "react";
import { toggleNotice } from "./noticeFunctions.js";
import { showMessage } from "./showMessage.js";
import { showError } from "./showError.js";

const MAX_PAGES_PER_LOAD = 20;

export function useLetterboxdList(mergeTile) {
  const allPagesLoadedRef = useRef(false);
  const watchlistPageCountRef = useRef(0);
  const scrollListenerRef = useRef(null);
  const isLoadingRef = useRef(false);
  const dataRef = useRef(null);
  const loadWatchlistRef = useRef(null);

  const processList = useCallback(
    async (data, responseData) => {
      try {
        const { error, watchlist, lastPage, totalPages } = responseData;
        allPagesLoadedRef.current = lastPage === totalPages;
        watchlistPageCountRef.current = totalPages;
        if (error) {
          showError(error);
          return;
        }
        for (const element of watchlist) {
          let { title, year, link, posterPath, poster } = element;
          poster = poster || "/movie_placeholder.svg";
          mergeTile?.(title, year, { poster, link });
          if (posterPath) {
            fetch(`https://letterboxd.com${posterPath}poster/std/230/`)
              .then((res) => res.json())
              .then((d) => d?.url && mergeTile?.(title, year, { poster: d.url, link }))
              .catch(() => {});
          }
          const movieData = { title, year, country: data.country ?? "" };
          fetch("/api/search-movie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(movieData),
          })
            .then((r) => r.json())
            .then((response) => {
              const { error: err, title: t, year: y, poster: p, link: l } = response;
              if (err) {
                showError(`[${t} (${y})] ${err}`);
                mergeTile?.(t, y, { poster: p, link: l, movieProviders: [] });
              } else {
                mergeTile?.(t, y, { ...response, link: l });
              }
            })
            .catch((e) => console.error(e));
        }
        data.page = lastPage;
        dataRef.current = data;
        if (!allPagesLoadedRef.current) {
          showMessage(`Loaded page ${data.page} of ${totalPages}...`);
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
                  watchlistPageCountRef.current - d.page,
                  MAX_PAGES_PER_LOAD
                );
                showMessage(`Loading another ${n} page chunk...`);
                (loadWatchlistRef.current || (() => Promise.resolve()))(d).finally(() => {
                  isLoadingRef.current = false;
                });
              }
            };
            scrollListenerRef.current = handleScroll;
            window.addEventListener("scroll", handleScroll, { passive: true });
          }
        } else {
          showMessage(
            totalPages ? `Loaded all ${totalPages} pages!` : "Loaded all pages!"
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(toggleNotice, 1000);
      }
    },
    []
  );

  const loadWatchlist = useCallback(async (data) => {
    const response = await fetch("/api/letterboxd-watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const responseData = await response.json();
    await processList(data, responseData);
  }, [processList]);

  loadWatchlistRef.current = loadWatchlist;

  const loadCustomList = useCallback(
    async (data) => {
      const response = await fetch("/api/letterboxd-custom-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const responseData = await response.json();
      await processList(data, responseData);
    },
    [processList]
  );

  const loadLetterboxdList = useCallback(
    async (listUrl, country) => {
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
      const data = {
        listUrl: listUrl.trim(),
        country,
        username,
        listType,
        page: 1,
      };
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
    };
  }, []);

  return loadLetterboxdList;
}
