import React, { useRef, useState, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MovieTile } from "./MovieTile";
import type { TileData } from "../utils/movieTiles";

const ROW_GAP = 28;
const COL_MIN_DESKTOP = 220;
const COL_MIN_TABLET = 180;
const ESTIMATED_ROW_PX = 360;

interface VirtualizedPosterShowcaseProps {
  tiles: TileData[];
  onAlternativeSearch: (tile: TileData) => void;
}

/**
 * Windowed tile grid. Only the rows near the viewport are mounted, so mount
 * cost is bounded by the viewport rather than the list length. Virtualizes
 * against the `.right-panel` scroll container (the app's natural scroller) using
 * `scrollMargin`, so the single scrollbar and the footer below the grid behave
 * exactly as they do in the non-virtualized layout.
 *
 * Trade-off: off-screen tiles do not exist, so per-tile enter/exit animations
 * cannot run — tiles render with `suppressAnimations`. This is the spike whose
 * feel we are evaluating (VITE_VIRTUALIZE=1).
 */
export function VirtualizedPosterShowcase({
  tiles,
  onAlternativeSearch,
}: VirtualizedPosterShowcaseProps): React.ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [cols, setCols] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const scroller = list.closest<HTMLElement>(".right-panel");
    setScrollEl(scroller);

    const measure = (): void => {
      const colMin = window.matchMedia("(max-width: 1024px)").matches
        ? COL_MIN_TABLET
        : COL_MIN_DESKTOP;
      const width = list.clientWidth;
      setCols(Math.max(1, Math.floor((width + ROW_GAP) / (colMin + ROW_GAP))));

      if (scroller) {
        const offset =
          list.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
        setScrollMargin(offset);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    if (scroller) ro.observe(scroller);
    return () => ro.disconnect();
  }, [tiles.length]);

  const rowCount = Math.ceil(tiles.length / cols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollEl,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 4,
    scrollMargin,
  });

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
              {rowTiles.map((tile, i) => (
                <MovieTile
                  key={tile.id}
                  data={tile}
                  index={start + i}
                  onAlternativeSearch={onAlternativeSearch}
                  suppressAnimations
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
