// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { AppStateProvider, useAppState } from "../AppStateContext";

const hoisted = vi.hoisted(() => ({
  loadLetterboxdListRaw: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../useLetterboxdList", () => ({
  useLetterboxdList: vi.fn(() => hoisted.loadLetterboxdListRaw),
}));

vi.mock("../useMovieSearch", () => ({
  useMovieSearch: vi.fn(() => vi.fn()),
}));

function SyncUrlProbe(): React.ReactElement {
  const { loadLetterboxdListWithSyncedUrl } = useAppState();
  React.useEffect(() => {
    loadLetterboxdListWithSyncedUrl("https://letterboxd.com/x/watchlist/");
  }, [loadLetterboxdListWithSyncedUrl]);
  return <div data-testid="sync-probe" />;
}

describe("loadLetterboxdListWithSyncedUrl", () => {
  beforeEach(() => {
    hoisted.loadLetterboxdListRaw.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses default country when the list form dev bridge is not registered", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AppStateProvider>
          <SyncUrlProbe />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hoisted.loadLetterboxdListRaw).toHaveBeenCalledWith(
      "https://letterboxd.com/x/watchlist/",
      "en_US",
    );
    root.unmount();
  });
});
