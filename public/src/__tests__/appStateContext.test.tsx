// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AppStateProvider, useAppState } from "../AppStateContext";

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
