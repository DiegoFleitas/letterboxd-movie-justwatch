import { test, expect } from "@playwright/test";
import { mockGeoIpRoute, searchMovieFixtures, waitForGeoReady } from "./app-test-helpers.js";

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Movie form", () => {
  test("submit triggers search and shows toast", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await expect(page.getByTestId("movie-form")).toBeVisible();

    const searchPromise = page.waitForResponse(
      (res) => res.url().includes("/api/search-movie") && res.request().method() === "POST",
      { timeout: 15000 },
    );

    const successFixture = searchMovieFixtures.find(
      (f) => (f.response as { message?: string })?.message === "Movie found",
    );
    const req = successFixture?.request as { title: string; year?: string | number };
    const res = successFixture?.response as {
      title?: string;
      year?: string | number;
      message?: string;
    };

    await page.route("**/api/search-movie", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(res),
      }),
    );

    await page.getByTestId("movie-input").fill(req.title);
    await page.getByTestId("movie-year").fill(String(req.year ?? ""));
    await expect(page.getByTestId("country-selector")).toBeAttached({ timeout: 5000 });
    await page.getByTestId("movie-submit").click();

    const response = await searchPromise;
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { title?: string; year?: string | number };
    expect(body.title).toBe(res.title);
    expect(body.year).toBe(res.year);

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: new RegExp(`${res.title ?? ""}|Available on|${res.message ?? ""}`) }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("API error shows error toast", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await expect(page.getByTestId("movie-form")).toBeVisible();

    const errorFixture = searchMovieFixtures.find((f) =>
      (f.response as { error?: string })?.error?.includes("Movie not found"),
    );
    const req = errorFixture?.request as { title: string; year?: string | number };
    const res = errorFixture?.response as { error?: string };

    await page.route("**/api/search-movie", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(res),
      }),
    );

    await page.getByTestId("movie-input").fill(req.title);
    await page.getByTestId("movie-year").fill(String(req.year ?? ""));
    await page.getByTestId("movie-submit").click();

    await expect(page.getByRole("status").filter({ hasText: "Movie not found" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("rapid submit clicks only trigger one movie request", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await expect(page.getByTestId("movie-form")).toBeVisible();

    let requestCount = 0;
    await page.route("**/api/search-movie", async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Inception",
          year: "2010",
          message: "Movie found",
          movieProviders: [],
        }),
      });
    });

    await page.getByTestId("movie-input").fill("Inception");
    await page.getByTestId("movie-year").fill("2010");

    const submit = page.getByTestId("movie-submit");
    await submit.click();
    await submit.click({ force: true });
    await submit.click({ force: true });
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("Searching...");

    await expect
      .poll(() => requestCount, { timeout: 3000, message: "movie request count should remain 1" })
      .toBe(1);
  });
});
