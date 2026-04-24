/**
 * Fetch live Letterboxd list/watchlist HTML and update test fixture files.
 * Run when Letterboxd changes their markup so tests stay aligned with real pages.
 *
 * Usage: bun run update:letterboxd-fixtures
 *   Or:  bun scripts/updateLetterboxdFixtures.ts [watchlist-url] [list-url]
 *
 * Defaults: shoemonger/watchlist (page 1), eibonslam/list/pelis-uru-cinemateca-gratis (page 1, with esiAllowFilters for fragment).
 */
import httpClientFactory from "@server/lib/axios.js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractGridHtml } from "@server/lib/letterboxdListHtml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const fixturesDir = join(rootDir, "tests", "fixtures");

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://letterboxd.com/",
};

const DEFAULT_WATCHLIST_URL = "https://letterboxd.com/shoemonger/watchlist/page/1/";
const DEFAULT_LIST_ESI_URL =
  "https://letterboxd.com/eibonslam/list/pelis-uru-cinemateca-gratis/page/1/?esiAllowFilters=true";

async function fetchAndExtract(url: string): Promise<string> {
  const client = httpClientFactory();
  const { data } = await client.get(url, {
    headers: BROWSER_HEADERS,
    responseType: "text",
  });
  const extracted = extractGridHtml(data);
  if (!extracted.trim()) {
    console.warn(`No grid/list content found at ${url}`);
  }
  return extracted;
}

function writeFixture(filename: string, comment: string, body: string): void {
  const path = join(fixturesDir, filename);
  const content = `<!-- ${comment} -->\n<!-- Updated by scripts/updateLetterboxdFixtures.ts -->\n${body.trim()}\n`;
  writeFileSync(path, content, "utf-8");
  console.log(`Wrote ${path}`);
}

async function main(): Promise<void> {
  const watchlistUrl = process.argv[2] ?? DEFAULT_WATCHLIST_URL;
  const listUrl = process.argv[3] ?? DEFAULT_LIST_ESI_URL;

  console.log("Fetching watchlist page...");
  const watchlistHtml = await fetchAndExtract(watchlistUrl);
  writeFixture(
    "letterboxd-watchlist-page.html",
    "Watchlist page structure: .poster-grid with .griditem, data-target-link, img[alt]. Source: " +
      watchlistUrl,
    watchlistHtml || '<div class="poster-grid"><ul class="grid"></ul></div>',
  );

  console.log("Fetching list (fragment) page...");
  const listHtml = await fetchAndExtract(listUrl);
  writeFixture(
    "letterboxd-list-fragment.html",
    "List/ESI fragment: li.listitem / .griditem with data-film-slug or data-target-link. Source: " +
      listUrl,
    listHtml || '<ul class="poster-list"><li class="listitem poster-container"></li></ul>',
  );

  console.log("Done. Run tests to ensure parser still works: bun run test");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
