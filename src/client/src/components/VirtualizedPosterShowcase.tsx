import React, { useRef, useState, useLayoutEffect } from "react";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { MovieTile } from "./MovieTile";
import type { TileData } from "../utils/movieTiles";

const ROW_GAP = 28;
const COL_MIN_DESKTOP = 220;
const COL_MIN_TABLET = 180;
const ESTIMATED_ROW_PX = 360;

/** Below this width the layout strips `.right-panel`'s bounded height, so the
 * window (document) scrolls instead of the panel — must match poster.css. */
const MOBILE_MAX_WIDTH = 767;

/** matchMedia guard — jsdom (tests) and SSR lack it. */
const matchesMedia = (query: string): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;

interface VirtualizedPosterShowcaseProps {
  tiles: TileData[];
  onAlternativeSearch: (tile: TileData) => void;
}

/**
 * Windowed tile grid. Only the rows near the viewport are mounted, so mount
 * cost is bounded by the viewport rather than the list length.
 *
 * The app uses two different scrollers by breakpoint: on desktop/tablet the
 * `.right-panel` element scrolls (bounded height + overflow), while on mobile
 * the layout removes that height and the document/window scrolls. So we run an
 * element virtualizer against `.right-panel` and a window virtualizer in
 * parallel and pick whichever matches the current breakpoint. Both use
 * `scrollMargin` to account for the grid's offset below the filter bar, so the
 * single scrollbar and the footer behave exactly as in the non-virtualized
 * layout.
 *
 * Tiles are static (no per-tile enter/exit animation) — off-screen tiles do not
 * exist, so those can't run anyway. A short CSS row fade-in (see
 * `.poster-virtual-row`) softens the reveal.
 */
export function VirtualizedPosterShowcase({
  tiles,
  onAlternativeSearch,
}: VirtualizedPosterShowcaseProps): React.ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [cols, setCols] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [isWindowScroll, setIsWindowScroll] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const scroller = list.closest<HTMLElement>(".right-panel");
    setScrollEl(scroller);

    const measure = (): void => {
      const windowScroll = matchesMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
      setIsWindowScroll(windowScroll);

      const colMin = matchesMedia("(max-width: 1024px)") ? COL_MIN_TABLET : COL_MIN_DESKTOP;
      setCols(Math.max(1, Math.floor((list.clientWidth + ROW_GAP) / (colMin + ROW_GAP))));

      if (windowScroll) {
        // Offset of the grid from the top of the document.
        setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
      } else if (scroller) {
        // Offset of the grid within the `.right-panel` scroll content.
        setScrollMargin(
          list.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop,
        );
      }
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    if (scroller) ro.observe(scroller);
    return () => ro.disconnect();
  }, [tiles.length]);

  const rowCount = Math.ceil(tiles.length / cols);

  // Both hooks run every render (rules of hooks); only the one matching the
  // current scroller is read below.
  const elementVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => (isWindowScroll ? null : scrollEl),
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 4,
    scrollMargin,
  });
  const windowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 4,
    scrollMargin,
  });
  const virtualizer = isWindowScroll ? windowVirtualizer : elementVirtualizer;

  return (
    <div ref={listRef} className="poster-virtual-list">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * cols;
          const rowTiles = tiles.slice(start, start + cols);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="poster-virtual-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {rowTiles.map((tile) => (
                <MovieTile key={tile.id} data={tile} onAlternativeSearch={onAlternativeSearch} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
