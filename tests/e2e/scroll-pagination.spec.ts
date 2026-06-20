import { test, expect } from "@playwright/test";
import {
  mockGeoIpRoute,
  mockListAndSearchRoutes,
  setupScrollListenerInterceptor,
  waitForGeoReady,
} from "./app-test-helpers.js";

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
  await setupScrollListenerInterceptor(page);
  await mockListAndSearchRoutes(page);
});

const cases = [
  {
    name: "Desktop",
    viewport: { width: 1280, height: 800 } as const,
    target: "right-panel",
  },
  {
    name: "Mobile",
    viewport: { width: 390, height: 800 } as const,
    target: "window",
  },
];

for (const { name, viewport, target } of cases) {
  test(`${name} — pagination scroll handler listens on ${target}`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();
    await expect(page.getByTestId("poster-showcase").getByTestId("tile").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).__scrollListenerInfo as Array<{
        target: string;
        handlerBody: string;
      }>;
    });

    const paginationHandler = info.find((h) => h.handlerBody.includes("allPagesLoadedRef"));
    if (!paginationHandler) throw new Error("Pagination handler not found");
    expect(paginationHandler.target).toBe(target);
  });
}
