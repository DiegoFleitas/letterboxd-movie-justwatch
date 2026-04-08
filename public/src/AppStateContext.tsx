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
import { createInitialTabbedTileState, mergeTileStateForTab } from "./movieTiles";
import type { MergeData, SearchTab, TabbedTileState, TileData, TileProvider } from "./movieTiles";
import { useLetterboxdList } from "./useLetterboxdList";
import { useMovieSearch } from "./useMovieSearch";
import {
  runAlternativeSearch as runAlternativeSearchRequest,
  searchSubs,
} from "./alternativeSearch";

export interface AppStateValue {
  movieTiles: Record<string, TileData>;
  streamingProviders: Record<string, TileProvider & { urls?: string[] }>;
  activeTab: SearchTab;
  notice: string | null;
  showAltSearchButton: boolean;
  isMovieSearchLoading: boolean;
  isListLoading: boolean;
  isAlternativeSearchLoading: boolean;
  setActiveTab: (tab: SearchTab) => void;
  setNotice: (msg: string | null) => void;
  setShowAltSearchButton: (show: boolean) => void;
  loadLetterboxdList: (listUrl: string, country: string) => Promise<void>;
  submitMovieSearch: (data: { title?: string; year?: string | number; country?: string }) => void;
  runAlternativeSearch: (title: string, year?: string | number) => void;
  searchSubs: (query: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function selectActiveTileState(
  tilesByTab: TabbedTileState,
  activeTab: SearchTab,
): TabbedTileState[SearchTab] {
  return tilesByTab[activeTab];
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function AppStateProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [tilesByTab, setTilesByTab] = useState<TabbedTileState>(createInitialTabbedTileState);
  const [activeTab, setActiveTab] = useState<SearchTab>("movie");
  const [notice, setNotice] = useState<string | null>(null);
  const [showAltSearchButton, setShowAltSearchButton] = useState(false);
  const [isMovieSearchLoading, setMovieSearchLoading] = useState(false);
  const [isListLoading, setListLoading] = useState(false);
  const [isAlternativeSearchLoading, setAlternativeSearchLoading] = useState(false);
  const loadingToastIdRef = useRef<string | number | null>(null);

  const mergeTileForTab = useCallback(
    (
      tab: SearchTab,
      title: string,
      year: string | number | null,
      data: Parameters<typeof mergeTileStateForTab>[4],
    ) => {
      setTilesByTab((prev: TabbedTileState) => mergeTileStateForTab(prev, tab, title, year, data));
    },
    [],
  );

  const mergeMovieTile = useCallback(
    (title: string, year: string | number | null, data: MergeData | null | undefined) => {
      mergeTileForTab("movie", title, year, data);
    },
    [mergeTileForTab],
  );

  const mergeListTile = useCallback(
    (title: string, year: string | number | null, data: MergeData | null | undefined) => {
      mergeTileForTab("list", title, year, data);
    },
    [mergeTileForTab],
  );

  const loadLetterboxdList = useLetterboxdList(mergeListTile, setListLoading);
  const submitMovieSearch = useMovieSearch(
    setShowAltSearchButton,
    setMovieSearchLoading,
    mergeMovieTile,
  );

  const runAlternativeSearch = useCallback((title: string, year?: string | number) => {
    runAlternativeSearchRequest(title, year, { setAlternativeSearchLoading });
  }, []);

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
    movieTiles: selectActiveTileState(tilesByTab, activeTab).movieTiles,
    streamingProviders: selectActiveTileState(tilesByTab, activeTab).streamingProviders,
    activeTab,
    notice,
    showAltSearchButton,
    isMovieSearchLoading,
    isListLoading,
    isAlternativeSearchLoading,
    setActiveTab,
    setNotice,
    setShowAltSearchButton,
    loadLetterboxdList,
    submitMovieSearch,
    runAlternativeSearch,
    searchSubs,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  ) as React.ReactElement;
}
