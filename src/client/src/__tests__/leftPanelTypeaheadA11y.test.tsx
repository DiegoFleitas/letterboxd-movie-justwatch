// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { LeftPanel } from "../LeftPanel";
import { mockFetchUrl } from "./reactRootTestUtils";

const COUNTRY_STORAGE_KEY = "letterboxd-justwatch-country";

describe("LeftPanel typeahead accessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem(COUNTRY_STORAGE_KEY, "en_US");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = mockFetchUrl(input);
        if (url.includes("/search/movie?query=")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  { id: 1, title: "Jurassic Park", release_date: "1993-01-01" },
                  { id: 2, title: "Jumanji", release_date: "1995-01-01" },
                ],
              }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(COUNTRY_STORAGE_KEY);
  });

  it("updates active option semantics and Enter selects highlighted suggestion", async () => {
    render(
      <AppStateProvider>
        <LeftPanel />
      </AppStateProvider>,
    );
    const input = screen.getByTestId("movie-input");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "jur" } });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox", { name: "Movie title suggestions" })).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBe("movie-suggestions-option-0");
    expect(
      screen.getByRole("option", { name: /Jurassic Park/i }).getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("movie-suggestions-option-1");
    expect(screen.getByRole("option", { name: /Jumanji/i }).getAttribute("aria-selected")).toBe(
      "true",
    );

    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toBe("Jumanji");
    expect(screen.queryByRole("listbox", { name: "Movie title suggestions" })).toBeNull();
  });

  it("renders placeholder poster and genre line when TMDB metadata is sparse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = mockFetchUrl(input);
        if (url.includes("/search/movie?query=")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [{ id: 99, title: "Sparse Film", genre_ids: [28] }],
              }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    render(
      <AppStateProvider>
        <LeftPanel />
      </AppStateProvider>,
    );
    const input = screen.getByTestId("movie-input");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "spa" } });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const opt = screen.getByRole("option", { name: /Sparse Film/i });
    expect(opt.querySelector(".typeahead-poster-placeholder")).not.toBeNull();
    expect(opt.textContent).toContain("Action");
  });
});
