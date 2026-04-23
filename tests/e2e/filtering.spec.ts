import { test, expect } from "@playwright/test";
import {
  findSearchMovieResponse,
  letterboxdFixtures,
  mockGeoIpRoute,
  type SearchMovieBody,
  waitForGeoReady,
} from "./app-test-helpers.js";

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Filtering", () => {
  test("clicking provider icon filters tiles", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    const listResponse = letterboxdFixtures[0].response;
    const twoFilms = {
      ...listResponse,
      watchlist: [listResponse.watchlist[0], listResponse.watchlist[12]],
    };

    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(twoFilms),
      }),
    );

    await page.route("**/api/search-movie", (route) => {
      const body = route.request().postDataJSON() as SearchMovieBody | null;
      const response = findSearchMovieResponse(body) || {
        title: body?.title,
        year: body?.year,
        error: "No fixture",
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();

    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(2, {
      timeout: 15000,
    });
    await expect(page.getByTestId("provider-icons").locator('img[alt="Disney Plus"]')).toBeVisible({
      timeout: 10000,
    });

    const disneyIcon = page
      .getByTestId("provider-icons")
      .locator(".streaming-provider-icon")
      .filter({ has: page.locator('img[alt="Disney Plus"]') })
      .first();
    await disneyIcon.click();

    const withProvider = page
      .getByTestId("poster-showcase")
      .getByTestId("tile")
      .filter({ hasText: "The Greatest Hits" });
    const withoutProvider = page
      .getByTestId("poster-showcase")
      .getByTestId("tile")
      .filter({ hasText: "A Ghost Story" });
    await expect(withProvider).toBeVisible();
    await expect(withoutProvider).toBeHidden();
  });
});
