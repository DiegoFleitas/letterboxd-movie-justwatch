// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AppStateProvider, useAppState } from "../AppStateContext";
import { RightPanel } from "../RightPanel";
import { jsonResponse } from "./jsonResponse";

vi.mock("../showMessage", () => ({
  showMessage: vi.fn(),
}));

vi.mock("../showError", () => ({
  showError: vi.fn(),
  showBatchErrors: vi.fn(),
}));

vi.mock("../noticeFunctions", () => ({
  toggleNotice: vi.fn(),
  setNoticeImpl: vi.fn(),
}));

vi.mock("../sentry", () => ({
  captureFrontendException: vi.fn(),
  captureFrontendMessage: vi.fn(),
}));

function SeedSearchThenPanel(): React.ReactElement {
  const { submitMovieSearch } = useAppState();
  React.useEffect(() => {
    submitMovieSearch({ title: "PanelTest", country: "en_US" });
  }, [submitMovieSearch]);
  return <RightPanel />;
}

describe("RightPanel filters", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("search-movie")) {
        return Promise.resolve(
          jsonResponse({
            title: "PanelTest",
            year: 2020,
            message: "Movie found",
            poster: "https://example.com/pt.jpg",
            link: "https://letterboxd.com/film/paneltest/",
            movieProviders: [
              {
                id: "nfx",
                name: "Netflix",
                icon: "https://example.com/n.png",
                url: "https://jw.example/n",
                type: "FLATRATE",
              },
            ],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows provider icon and toggles filter on click", async () => {
    await act(async () => {
      render(
        <AppStateProvider>
          <SeedSearchThenPanel />
        </AppStateProvider>,
      );
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("provider-icons").querySelector('[data-sp="Netflix"]'),
      ).toBeTruthy();
    });
    const btn = screen
      .getByTestId("provider-icons")
      .querySelector('[data-sp="Netflix"]') as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});
