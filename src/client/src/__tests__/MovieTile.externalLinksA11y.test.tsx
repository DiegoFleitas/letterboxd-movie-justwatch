// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { AppStateProvider } from "../AppStateContext";
import { MovieTile } from "../MovieTile";
import type { TileData } from "../movieTiles";

describe("MovieTile external links accessibility label", () => {
  it("includes rendered external links and SubDL in group label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "1999-FOO",
      title: "Foo",
      year: "1999",
      link: "https://letterboxd.com/film/foo/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    const externalGroup = container.querySelector('[role="group"].poster-external-stack');
    expect(externalGroup?.getAttribute("aria-label")).toBe(
      "Foo (1999) — Letterboxd, SubDL, OpenSubtitles",
    );
  });
});
