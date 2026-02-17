// @ts-check
/**
 * E2E tests are UI-only: drive the app via forms, clicks, and visibility.
 * No window.submitMovieSearch / window.submitLetterboxdList so they stay valid after full React migration.
 */
import { test, expect } from '@playwright/test';

test.describe('App shell and left panel', () => {
  test('loads and shows country selector, tabs, and movie form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('left-panel')).toBeVisible();
    await expect(page.getByTestId('country-selector')).toBeVisible();
    await expect(page.getByTestId('tab-movie')).toBeVisible();
    await expect(page.getByTestId('tab-list')).toBeVisible();
    await expect(page.getByTestId('movie-form')).toBeVisible();
    await expect(page.getByTestId('movie-input')).toBeVisible();
    await expect(page.getByTestId('movie-year')).toBeVisible();
    await expect(page.getByTestId('movie-submit')).toBeVisible();
  });

  test('switching to List tab shows list form', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('tab-list').click();
    await expect(page.getByTestId('list-form')).toBeVisible();
    await expect(page.getByTestId('list-url')).toBeVisible();
    await expect(page.getByTestId('list-submit')).toBeVisible();
  });

  test('right panel has poster showcase and provider icons container', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('left-panel')).toBeVisible();

    await expect(page.getByTestId('right-panel')).toBeVisible();
    await expect(page.getByTestId('poster-showcase')).toBeVisible();
    await expect(page.getByTestId('provider-icons')).toBeAttached();
  });
});

test.describe('Movie form', () => {
  test('submit triggers search and shows toast', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('movie-form')).toBeVisible();

    const searchPromise = page.waitForResponse(
      (res) => res.url().includes('/api/search-movie') && res.request().method() === 'POST',
      { timeout: 15000 }
    );

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Jurassic Park',
          year: '1993',
          message: 'Available on',
          movieProviders: [{ name: 'Netflix', id: 1, icon: '', url: '' }],
        }),
      })
    );

    await page.getByTestId('movie-input').fill('Jurassic Park');
    await page.getByTestId('movie-year').fill('1993');
    await expect(page.locator('#country-global option').first()).toBeAttached({ timeout: 5000 });
    await page.getByTestId('movie-submit').click();

    const response = await searchPromise;
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.title).toBe('Jurassic Park');
    expect(body.year).toBe('1993');

    await expect(page.getByRole('status').filter({ hasText: /Jurassic Park|Available on/ })).toBeVisible({ timeout: 5000 });
  });

  test('API error shows error toast', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('movie-form')).toBeVisible();

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Unknown Movie',
          year: '1999',
          error: 'No results found.',
        }),
      })
    );

    await page.getByTestId('movie-input').fill('Unknown Movie');
    await page.getByTestId('movie-year').fill('1999');
    await page.getByTestId('movie-submit').click();

    await expect(page.getByText(/Unknown Movie.*No results found|No results found/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('List form', () => {
  test('submit with valid watchlist URL loads tiles into poster showcase', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          watchlist: [
            {
              title: 'The Matrix',
              year: '1999',
              link: '/film/the-matrix/',
              posterPath: null,
              poster: null,
            },
          ],
          lastPage: 1,
          totalPages: 1,
        }),
      })
    );

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'The Matrix',
          year: '1999',
          message: 'Available on',
          movieProviders: [{ name: 'Netflix', id: 1, icon: '', url: '' }],
          poster: null,
        }),
      })
    );

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/someuser/watchlist/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('[data-id]').filter({ hasText: 'The Matrix' })).toBeVisible();
  });

  test('invalid list URL shows error toast and no tiles', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://example.com/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByText(/Invalid URL format|valid URL/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(0);
  });
});

test.describe('Filtering', () => {
  test('clicking provider icon filters tiles', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          watchlist: [
            { title: 'Movie A', year: '2020', link: '/film/movie-a/', posterPath: null, poster: null },
            { title: 'Movie B', year: '2021', link: '/film/movie-b/', posterPath: null, poster: null },
          ],
          lastPage: 1,
          totalPages: 1,
        }),
      })
    );

    await page.route('**/api/search-movie', (route) => {
      const body = route.request().postDataJSON();
      const hasNetflix = body?.title === 'Movie A';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: body?.title || 'Unknown',
          year: body?.year || '',
          message: 'Available on',
          movieProviders: hasNetflix
            ? [{ name: 'Netflix', id: 1, icon: '', url: '' }]
            : [{ name: 'Disney+', id: 2, icon: '', url: '' }],
          poster: null,
        }),
      });
    });

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/user/watchlist/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(2, { timeout: 15000 });
    await expect(page.getByTestId('provider-icons').locator('img[alt="Netflix"]')).toBeVisible({ timeout: 10000 });

    const netflixIcon = page.getByTestId('provider-icons').locator('.streaming-provider-icon').filter({ has: page.locator('img[alt="Netflix"]') }).first();
    await netflixIcon.click();

    const tileMovieA = page.getByTestId('poster-showcase').getByTestId('tile').filter({ hasText: 'Movie A' });
    const tileMovieB = page.getByTestId('poster-showcase').getByTestId('tile').filter({ hasText: 'Movie B' });
    await expect(tileMovieA).toBeVisible();
    await expect(tileMovieB).toBeHidden();
  });
});

test.describe('Alternative search', () => {
  test('alternative search button triggers API and shows result', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Inception',
          year: '2010',
          message: 'Available on',
          movieProviders: [],
        }),
      })
    );

    await page.getByTestId('movie-input').fill('Inception');
    await page.getByTestId('movie-year').fill('2010');
    await page.getByTestId('movie-submit').click();

    await expect(page.getByRole('status').filter({ hasText: /Inception|Available on/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('alternative-search-btn')).toBeVisible({ timeout: 3000 });

    await page.route('**/api/alternative-search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: 'Found on Example',
          url: 'https://example.com/torrent',
          title: 'Inception',
        }),
      })
    );

    await page.getByTestId('alternative-search-btn').click();

    await expect(page.getByText(/Found on Example/)).toBeVisible({ timeout: 5000 });
  });
});
