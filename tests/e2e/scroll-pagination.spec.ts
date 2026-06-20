import { test, expect } from "@playwright/test";
import {
  letterboxdFixtures,
  mockGeoIpRoute,
  type SearchMovieBody,
  waitForGeoReady,
} from "./app-test-helpers.js";

/** Desktop: verify the pagination scroll handler listens on `.right-panel`
 *  (the desktop scroll container) rather than `window`.
 */
test.describe("Desktop — scroll-listener target", () => {
  test("pagination scroll handler listens on .right-panel, not window", async ({ page }) => {
    // Intercept scroll addEventListener to capture the target for the
    // pagination handler (identified by its body text).
    await page.addInitScript(() => {
      const original = EventTarget.prototype.addEventListener;
      const info: Array<{ target: string; handlerBody: string }> = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__scrollListenerInfo = info;

      EventTarget.prototype.addEventListener = function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type === "scroll" && typeof listener === "function") {
          const targetName =
            this === globalThis
              ? "window"
              : (this as Element).className || (this as Element).tagName || "unknown";
          info.push({ target: targetName, handlerBody: listener.toString().slice(0, 300) });
        }
        return original.call(this, type, listener, options);
      };
    });

    await mockGeoIpRoute(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route("**/api/letterboxd-watchlist", (route) => {
      const baseList = (
        letterboxdFixtures[0] as {
          response: { watchlist: Array<{ title?: string; year?: string | number }> };
        }
      ).response.watchlist;
      const watchlist = baseList.map((e) => ({ ...e }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "List found",
          watchlist,
          lastPage: 1,
          totalPages: 5,
          hasMore: true,
        }),
      });
    });
    await page.route("**/api/search-movie", (route) => {
      const body = route.request().postDataJSON() as SearchMovieBody | null;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Movie found",
          movieProviders: [],
          title: body?.title,
          year: body?.year,
        }),
      });
    });

    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();
    await expect(page.getByTestId("poster-showcase").getByTestId("tile").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    const info = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__scrollListenerInfo as Array<{ target: string; handlerBody: string }>,
    );

    // Find the pagination handler (it references allPagesLoadedRef).
    const paginationHandler = info.find((h) => h.handlerBody.includes("allPagesLoadedRef"));
    expect(paginationHandler).toBeDefined();

    // The pagination handler should listen on the panel, not window.
    // On desktop `.right-panel` is the actual scroll container.
    // Currently it listens on `window` — this assertion fails.
    expect(paginationHandler!.target).toBe("right-panel");
  });
});

/** Mobile: confirm the pagination handler correctly listens on window. */
test.describe("Mobile — scroll-listener target", () => {
  test("pagination scroll handler listens on window (correct for mobile)", async ({ page }) => {
    await page.addInitScript(() => {
      const original = EventTarget.prototype.addEventListener;
      const info: Array<{ target: string; handlerBody: string }> = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__scrollListenerInfo = info;

      EventTarget.prototype.addEventListener = function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type === "scroll" && typeof listener === "function") {
          const targetName =
            this === globalThis
              ? "window"
              : (this as Element).className || (this as Element).tagName || "unknown";
          info.push({ target: targetName, handlerBody: listener.toString().slice(0, 300) });
        }
        return original.call(this, type, listener, options);
      };
    });

    await mockGeoIpRoute(page);
    await page.setViewportSize({ width: 390, height: 800 });

    await page.route("**/api/letterboxd-watchlist", (route) => {
      const baseList = (
        letterboxdFixtures[0] as {
          response: { watchlist: Array<{ title?: string; year?: string | number }> };
        }
      ).response.watchlist;
      const watchlist = baseList.map((e) => ({ ...e }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "List found",
          watchlist,
          lastPage: 1,
          totalPages: 5,
          hasMore: true,
        }),
      });
    });
    await page.route("**/api/search-movie", (route) => {
      const body = route.request().postDataJSON() as SearchMovieBody | null;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Movie found",
          movieProviders: [],
          title: body?.title,
          year: body?.year,
        }),
      });
    });

    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();
    await expect(page.getByTestId("poster-showcase").getByTestId("tile").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    const info = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__scrollListenerInfo as Array<{ target: string; handlerBody: string }>,
    );

    // On mobile the handler correctly listens on window.
    const paginationHandler = info.find((h) => h.handlerBody.includes("allPagesLoadedRef"));
    expect(paginationHandler).toBeDefined();
    expect(paginationHandler!.target).toBe("window");
  });
});
