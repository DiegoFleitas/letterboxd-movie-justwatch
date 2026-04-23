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

test.describe("List form", () => {
  test("submit with valid watchlist URL loads tiles into poster showcase", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    const listResponse = letterboxdFixtures[0].response;
    const oneFilm = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 1),
    };

    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(oneFilm),
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
    await page.getByTestId("list-url").fill("https://letterboxd.com/someuser/watchlist/");
    await page.getByTestId("list-submit").click();

    const firstTitle = oneFilm.watchlist[0].title;
    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(page.locator("[data-id]").filter({ hasText: firstTitle ?? "" })).toBeVisible();
  });

  test("rapid submit clicks only trigger one list request", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();

    let listRequestCount = 0;
    await page.route("**/api/letterboxd-watchlist", async (route) => {
      listRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "List found",
          watchlist: [],
          lastPage: 1,
          totalPages: 1,
        }),
      });
    });

    await page.getByTestId("list-url").fill("https://letterboxd.com/someuser/watchlist/");
    const submit = page.getByTestId("list-submit");
    await submit.click();
    await submit.click({ force: true });
    await submit.click({ force: true });

    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("Submitting...");
    await expect
      .poll(() => listRequestCount, {
        timeout: 3000,
        message: "list request count should remain 1",
      })
      .toBe(1);
  });

  test("invalid list URL shows error toast and no tiles", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://example.com/");
    await page.getByTestId("list-submit").click();

    const errorToast = page.getByRole("status").first();
    await expect(errorToast).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(0);
  });

  test("list load with multiple movie errors shows one grouped error toast", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    const listResponse = letterboxdFixtures[0].response;
    const threeErrorFilms = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 3),
    };

    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(threeErrorFilms),
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

    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(3, {
      timeout: 15000,
    });
    const groupedToast = page
      .getByRole("status")
      .filter({ hasText: /3 titles (encountered errors|:)/ });
    await expect(groupedToast).toBeVisible({ timeout: 5000 });
    await expect(groupedToast).toHaveCount(1);
  });

  test("list load with one movie error shows single-movie error toast", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    const listResponse = letterboxdFixtures[0].response;
    const oneErrorFilm = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 1),
    };

    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(oneErrorFilm),
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

    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(
      page.getByRole("status").filter({ hasText: /A Ghost Story|No streaming|alternative search/ }),
    ).toBeVisible({ timeout: 5000 });
  });
});
