import { test, expect } from "@playwright/test";
import { mockGeoIpRoute, waitForGeoReady } from "./app-test-helpers.js";

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Alternative search", () => {
  test("alternative search button triggers API and shows result", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    await page.route("**/api/search-movie", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Inception",
          year: "2010",
          message: "Available on",
          movieProviders: [],
        }),
      }),
    );

    await page.getByTestId("movie-input").fill("Inception");
    await page.getByTestId("movie-year").fill("2010");
    await page.getByTestId("movie-submit").click();

    await expect(
      page.getByRole("status").filter({ hasText: /Inception|Available on/ }),
    ).toBeVisible({ timeout: 5000 });
    const altButton = page
      .getByTestId("poster-showcase")
      .locator('button[data-sp="alternative-search-tile"]')
      .first();
    await expect(altButton).toBeVisible({ timeout: 3000 });

    await page.route("**/api/alternative-search", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: "Found on Example",
          url: "https://example.com/torrent",
          title: "Inception",
        }),
      }),
    );

    await altButton.click({ force: true });

    await expect(page.getByText(/Found on Example/)).toBeVisible({ timeout: 5000 });
  });

  test("rapid clicks only trigger one alternative search request", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);

    await page.route("**/api/search-movie", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Inception",
          year: "2010",
          message: "Available on",
          movieProviders: [],
        }),
      }),
    );

    await page.getByTestId("movie-input").fill("Inception");
    await page.getByTestId("movie-year").fill("2010");
    await page.getByTestId("movie-submit").click();
    const altBtn = page
      .getByTestId("poster-showcase")
      .locator('button[data-sp="alternative-search-tile"]')
      .first();
    await expect(altBtn).toBeVisible({ timeout: 3000 });

    let altRequestCount = 0;
    await page.route("**/api/alternative-search", async (route) => {
      altRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: "Found on Example",
          url: "https://example.com/torrent",
          title: "Inception",
        }),
      });
    });

    await altBtn.click({ force: true });
    await altBtn.click({ force: true });
    await altBtn.click({ force: true });
    await expect
      .poll(() => altRequestCount, {
        timeout: 3000,
        message: "alternative request count should remain 1",
      })
      .toBe(1);
  });
});
