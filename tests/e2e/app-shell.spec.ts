import { test, expect } from "@playwright/test";
import { mockGeoIpRoute, waitForGeoReady } from "./app-test-helpers.js";

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("App shell and left panel", () => {
  test("loads and shows country selector, tabs, and movie form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("left-panel")).toBeVisible();
    await expect(page.getByTestId("country-selector")).toBeVisible();
    await expect(page.getByTestId("tab-movie")).toBeVisible();
    await expect(page.getByTestId("tab-list")).toBeVisible();
    await expect(page.getByTestId("movie-form")).toBeVisible();
    await expect(page.getByTestId("movie-input")).toBeVisible();
    await expect(page.getByTestId("movie-year")).toBeVisible();
    await expect(page.getByTestId("movie-submit")).toBeVisible();
  });

  test("automatic country detection uses geo mock and shows detected country", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("letterboxd-justwatch-country"));
    await page.reload();
    await expect(page.getByTestId("country-selector")).toBeVisible();
    await expect(
      page.getByTestId("country-selector").getByRole("button", { name: "Uruguay" }),
    ).toBeVisible();
  });

  test("switching to List tab shows list form", async ({ page }) => {
    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await expect(page.getByTestId("list-form")).toBeVisible();
    await expect(page.getByTestId("list-url")).toBeVisible();
    await expect(page.getByTestId("list-submit")).toBeVisible();
  });

  test("right panel has poster showcase and provider icons container", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("left-panel")).toBeVisible();

    await expect(page.getByTestId("right-panel")).toBeVisible();
    await expect(page.getByTestId("poster-showcase")).toBeVisible();
    await expect(page.getByTestId("provider-icons")).toBeAttached();
  });
});
