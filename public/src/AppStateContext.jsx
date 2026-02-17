import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getToastImpl } from "./toastApi.js";
import { setNoticeImpl } from "./noticeFunctions.js";
import { mergeTileState } from "./movieTiles.js";
import { useLetterboxdList } from "./useLetterboxdList.js";
import { useMovieSearch } from "./useMovieSearch.js";
import { runAlternativeSearch, searchSubs } from "./alternativeSearch.js";

const AppStateContext = createContext(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

const initialAppData = { movieTiles: {}, streamingProviders: {} };

export function AppStateProvider({ children }) {
  const [appData, setAppData] = useState(initialAppData);
  const [notice, setNotice] = useState(null);
  const [showAltSearchButton, setShowAltSearchButton] = useState(false);
  const loadingToastIdRef = useRef(null);

  const mergeTile = useCallback((title, year, data) => {
    setAppData((prev) => mergeTileState(prev, title, year, data));
  }, []);

  const loadLetterboxdList = useLetterboxdList(mergeTile);
  const submitMovieSearch = useMovieSearch(setShowAltSearchButton);

  useEffect(() => {
    const impl = getToastImpl();
    if (!impl) return;
    if (notice) {
      if (loadingToastIdRef.current != null) impl.dismissLoading(loadingToastIdRef.current);
      loadingToastIdRef.current = impl.loading(notice);
    } else {
      if (loadingToastIdRef.current != null) {
        impl.dismissLoading(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }
  }, [notice]);

  useEffect(() => {
    setNoticeImpl(setNotice);
    return () => setNoticeImpl(null);
  }, [setNotice]);

  const value = {
    movieTiles: appData.movieTiles,
    streamingProviders: appData.streamingProviders,
    notice,
    showAltSearchButton,
    setNotice,
    setShowAltSearchButton,
    loadLetterboxdList,
    submitMovieSearch,
    runAlternativeSearch,
    searchSubs,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
