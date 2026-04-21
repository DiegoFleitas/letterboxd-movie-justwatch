// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MovieTile } from "../MovieTile";
import type { TileData } from "../movieTiles";

describe("MovieTile external links accessibility label", () => {
  it("includes only rendered external links in group label", async () => {
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
      root.render(<MovieTile data={tileData} suppressAnimations />);
    });

    const externalGroup = container.querySelector('[role="group"].poster-external-stack');
    expect(externalGroup?.getAttribute("aria-label")).toBe("Foo (1999) — Letterboxd");
  });
});
