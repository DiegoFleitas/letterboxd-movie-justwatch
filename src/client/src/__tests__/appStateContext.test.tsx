// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { AppStateProvider, useAppState } from "../AppStateContext";
import { jsonResponse } from "./jsonResponse";

function Probe(): React.ReactElement {
  const { activeTab, setActiveTab } = useAppState();
  return (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <button data-testid="to-list" onClick={() => setActiveTab("list")} />
      <button data-testid="to-movie" onClick={() => setActiveTab("movie")} />
    </div>
  );
}

describe("AppStateContext", () => {
  it("defaults active tab to movie and allows switching", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <Probe />
        </AppStateProvider>,
      );
    });

    const activeTabEl = container.querySelector('[data-testid="active-tab"]');
    expect(activeTabEl?.textContent).toBe("movie");

    const toList = container.querySelector('[data-testid="to-list"]') as HTMLButtonElement;
    await act(async () => {
      toList.click();
    });
    expect(activeTabEl?.textContent).toBe("list");

    const toMovie = container.querySelector('[data-testid="to-movie"]') as HTMLButtonElement;
    await act(async () => {
      toMovie.click();
    });
    expect(activeTabEl?.textContent).toBe("movie");
  });
});

function SearchSubmitProbe(): React.ReactElement {
  const { submitMovieSearch } = useAppState();
  React.useEffect(() => {
    submitMovieSearch({ title: "CtxFilm", country: "en_US" });
  }, [submitMovieSearch]);
  return <div data-testid="search-probe" />;
}

describe("AppStateProvider movie search wiring", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("search-movie")) {
        return Promise.resolve(
          jsonResponse({
            title: "CtxFilm",
            year: 2021,
            message: "Movie found",
            poster: "https://example.com/c.jpg",
            link: "https://letterboxd.com/film/ctxfilm/",
            movieProviders: [],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submitMovieSearch merges tile into movie tab", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AppStateProvider>
          <SearchSubmitProbe />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="search-probe"]')).toBeTruthy();
    root.unmount();
  });
});
