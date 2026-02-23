// @ts-check
/**
 * E2E tests are UI-only: drive the app via forms, clicks, and visibility.
 * No window.submitMovieSearch / window.submitLetterboxdList so they stay valid after full React migration.
 * List and search mocks use tests/fixtures/api/*.json for real API response shapes.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test, expect } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'tests', 'fixtures', 'api');
const letterboxdFixtures = JSON.parse(readFileSync(join(fixturesDir, 'letterboxd-watchlist.json'), 'utf-8'));
const searchMovieFixtures = JSON.parse(readFileSync(join(fixturesDir, 'search-movie.json'), 'utf-8'));

function findSearchMovieResponse(body) {
  const t = (v) => (v == null ? '' : String(v));
  const entry = searchMovieFixtures.find(
    (f) =>
      t(f.request?.title) === t(body?.title) &&
      t(f.request?.year) === t(body?.year) &&
      t(f.request?.country) === t(body?.country)
  );
  return entry ? entry.response : null;
}

/** Wait for automatic geo to complete so the country selector is stable (mock returns UY). */
async function waitForGeoReady(page) {
  await expect(page.getByTestId('country-selector').getByText('Uruguay')).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  // Mock ipapi.co so automatic geo detection returns UY; fixtures use es_UY so requests match.
  await page.route('**/ipapi.co/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ country_code: 'UY', ip: '127.0.0.1' }),
    })
  );
});

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

  test('automatic country detection uses geo mock and shows detected country', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('letterboxd-justwatch-country'));
    await page.reload();
    await expect(page.getByTestId('country-selector')).toBeVisible();
    await expect(page.getByTestId('country-selector').getByText('Uruguay')).toBeVisible();
  });

  test('switching to List tab shows list form', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);
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
    await waitForGeoReady(page);
    await expect(page.getByTestId('movie-form')).toBeVisible();

    const searchPromise = page.waitForResponse(
      (res) => res.url().includes('/api/search-movie') && res.request().method() === 'POST',
      { timeout: 15000 }
    );

    // Use fixture: The Greatest Hits has message + movieProviders (Disney Plus)
    const successFixture = searchMovieFixtures.find((f) => f.response?.message === 'Movie found');
    const { request: req, response: res } = successFixture;

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      })
    );

    await page.getByTestId('movie-input').fill(req.title);
    await page.getByTestId('movie-year').fill(String(req.year ?? ''));
    await expect(page.getByTestId('country-selector')).toBeAttached({ timeout: 5000 });
    await page.getByTestId('movie-submit').click();

    const response = await searchPromise;
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.title).toBe(res.title);
    expect(body.year).toBe(res.year);

    await expect(page.getByRole('status').filter({ hasText: new RegExp(`${res.title}|Available on|${res.message || ''}`) })).toBeVisible({ timeout: 5000 });
  });

  test('API error shows error toast', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);
    await expect(page.getByTestId('movie-form')).toBeVisible();

    // Use fixture: e.g. The Little Drummer Girl has error "Movie not found (TMDB)"
    const errorFixture = searchMovieFixtures.find((f) => f.response?.error?.includes('Movie not found'));
    const { request: req, response: res } = errorFixture;

    await page.route('**/api/search-movie', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      })
    );

    await page.getByTestId('movie-input').fill(req.title);
    await page.getByTestId('movie-year').fill(String(req.year ?? ''));
    await page.getByTestId('movie-submit').click();

    await expect(page.getByText(new RegExp(`${req.title}|${(res.error || '').substring(0, 25)}`))).toBeVisible({ timeout: 5000 });
  });
});

test.describe('List form', () => {
  test('submit with valid watchlist URL loads tiles into poster showcase', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);

    // Use fixture: one film from letterboxd watchlist so one tile + one search-movie call
    const listResponse = letterboxdFixtures[0].response;
    const oneFilm = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 1),
    };

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(oneFilm),
      })
    );

    await page.route('**/api/search-movie', (route) => {
      const body = route.request().postDataJSON();
      const response = findSearchMovieResponse(body) || { title: body?.title, year: body?.year, error: 'No fixture' };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/someuser/watchlist/');
    await page.getByTestId('list-submit').click();

    const firstTitle = oneFilm.watchlist[0].title;
    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('[data-id]').filter({ hasText: firstTitle })).toBeVisible();
  });

  test('invalid list URL shows error toast and no tiles', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);
    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://example.com/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByText(/Invalid URL format|valid URL/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(0);
  });

  test('list load with multiple movie errors shows one grouped error toast', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);

    // Three films that all have error responses in search-movie fixtures (no streaming / not found)
    const listResponse = letterboxdFixtures[0].response;
    const threeErrorFilms = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 3), // A Ghost Story, The Old Man & the Gun, The Little Drummer Girl
    };

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(threeErrorFilms),
      })
    );

    await page.route('**/api/search-movie', (route) => {
      const body = route.request().postDataJSON();
      const response = findSearchMovieResponse(body) || { title: body?.title, year: body?.year, error: 'No fixture' };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/user/watchlist/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(3, { timeout: 15000 });
    const groupedToast = page.getByRole('status').filter({ hasText: /3 titles (encountered errors|:)/ });
    await expect(groupedToast).toBeVisible({ timeout: 5000 });
    await expect(groupedToast).toHaveCount(1);
  });

  test('list load with one movie error shows single-movie error toast', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);

    const listResponse = letterboxdFixtures[0].response;
    const oneErrorFilm = {
      ...listResponse,
      watchlist: listResponse.watchlist.slice(0, 1), // A Ghost Story - has error fixture
    };

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(oneErrorFilm),
      })
    );

    await page.route('**/api/search-movie', (route) => {
      const body = route.request().postDataJSON();
      const response = findSearchMovieResponse(body) || { title: body?.title, year: body?.year, error: 'No fixture' };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/user/watchlist/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(1, { timeout: 10000 });
    await expect(
      page.getByRole('status').filter({ hasText: /A Ghost Story|No streaming|pirate flags/ })
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Filtering', () => {
  test('clicking provider icon filters tiles', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);

    // Use fixture: two films — The Greatest Hits (Disney Plus), A Ghost Story (no providers)
    const listResponse = letterboxdFixtures[0].response;
    const twoFilms = {
      ...listResponse,
      watchlist: [listResponse.watchlist[0], listResponse.watchlist[12]], // A Ghost Story, The Greatest Hits
    };

    await page.route('**/api/letterboxd-watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(twoFilms),
      })
    );

    await page.route('**/api/search-movie', (route) => {
      const body = route.request().postDataJSON();
      const response = findSearchMovieResponse(body) || { title: body?.title, year: body?.year, error: 'No fixture' };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.getByTestId('tab-list').click();
    await page.getByTestId('list-url').fill('https://letterboxd.com/user/watchlist/');
    await page.getByTestId('list-submit').click();

    await expect(page.getByTestId('poster-showcase').getByTestId('tile')).toHaveCount(2, { timeout: 15000 });
    await expect(page.getByTestId('provider-icons').locator('img[alt="Disney Plus"]')).toBeVisible({ timeout: 10000 });

    const disneyIcon = page.getByTestId('provider-icons').locator('.streaming-provider-icon').filter({ has: page.locator('img[alt="Disney Plus"]') }).first();
    await disneyIcon.click();

    const withProvider = page.getByTestId('poster-showcase').getByTestId('tile').filter({ hasText: 'The Greatest Hits' });
    const withoutProvider = page.getByTestId('poster-showcase').getByTestId('tile').filter({ hasText: 'A Ghost Story' });
    await expect(withProvider).toBeVisible();
    await expect(withoutProvider).toBeHidden();
  });
});

test.describe('Alternative search', () => {
  test('alternative search button triggers API and shows result', async ({ page }) => {
    await page.goto('/');
    await waitForGeoReady(page);

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
