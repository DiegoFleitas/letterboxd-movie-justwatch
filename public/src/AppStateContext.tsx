import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { getToastImpl } from "./toastApi";
import { setNoticeImpl } from "./noticeFunctions";
import { mergeTileState } from "./movieTiles";
import type { TileState } from "./movieTiles";
import { useLetterboxdList } from "./useLetterboxdList";
import { useMovieSearch } from "./useMovieSearch";
import { runAlternativeSearch, searchSubs } from "./alternativeSearch";

export interface AppStateValue {
  movieTiles: TileState["movieTiles"];
  streamingProviders: TileState["streamingProviders"];
  notice: string | null;
  showAltSearchButton: boolean;
  setNotice: (msg: string | null) => void;
  setShowAltSearchButton: (show: boolean) => void;
  loadLetterboxdList: (listUrl: string, country: string) => Promise<void>;
  submitMovieSearch: (data: { title?: string; year?: string | number; country?: string }) => void;
  runAlternativeSearch: (title: string, year?: string | number) => void;
  searchSubs: (query: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

const initialAppData: TileState = { movieTiles: {}, streamingProviders: {} };

export function AppStateProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [appData, setAppData] = useState<TileState>(initialAppData);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAltSearchButton, setShowAltSearchButton] = useState(false);
  const loadingToastIdRef = useRef<string | number | null>(null);

  const mergeTile = useCallback(
    (title: string, year: string | number | null, data: Parameters<typeof mergeTileState>[3]) => {
      setAppData((prev: TileState) => mergeTileState(prev, title, year, data));
    },
    []
  );

  const loadLetterboxdList = useLetterboxdList(mergeTile);
  const submitMovieSearch = useMovieSearch(setShowAltSearchButton);

  useEffect(() => {
    const impl = getToastImpl();
    if (!impl) return;
    if (notice) {
      if (loadingToastIdRef.current != null && impl.dismissLoading)
        impl.dismissLoading(loadingToastIdRef.current);
      loadingToastIdRef.current = impl.loading?.(notice) ?? null;
    } else {
      if (loadingToastIdRef.current != null && impl.dismissLoading) {
        impl.dismissLoading(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }
  }, [notice]);

  useEffect(() => {
    setNoticeImpl(setNotice);
    return () => setNoticeImpl(null);
  }, []);

  const value: AppStateValue = {
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
  ) as React.ReactElement;
}
