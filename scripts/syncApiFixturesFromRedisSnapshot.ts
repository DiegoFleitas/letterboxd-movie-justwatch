/**
 * Regenerate tests/fixtures/api/*.json from redis/data/redis-snapshot.json.
 * Run: bun scripts/syncApiFixturesFromRedisSnapshot.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const snapshotPath = path.join(rootDir, "redis", "data", "redis-snapshot.json");

const digestOf = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function extractDigest(fullKey: string): string | null {
  const i = fullKey.indexOf(":");
  if (i < 0) return null;
  return fullKey.slice(i + 1);
}

function yearCandidates(year: unknown): string[] {
  if (year === undefined || year === null) return [""];
  if (typeof year === "string") return [...new Set([year])];
  if (typeof year === "number" && Number.isFinite(year)) return [...new Set([String(year)])];
  return [""];
}

function titleCandidates(obj: { title?: unknown }): string[] {
  const t = obj.title;
  if (typeof t !== "string" || !t.length) return [];
  return [...new Set([t])];
}

type SearchEntry = {
  request: { title: string; year: string | number; country: string };
  response: unknown;
};

function isSearchPayload(o: Record<string, unknown>): boolean {
  const hasProviders = Array.isArray(o.movieProviders);
  const hasSearchError = typeof o.error === "string" && "title" in o;
  return hasProviders || hasSearchError;
}

function matchLogicalKey(
  digest: string,
  titles: string[],
  years: string[],
  country: string,
): string | null {
  for (const title of titles) {
    for (const y of years) {
      const logical = `search-movie:${title}:${y}:${country}`;
      if (digestOf(logical) === digest) return logical;
    }
  }
  return null;
}

function extraYearStrings(y0: unknown): string[] {
  const extra: string[] = [];
  if (typeof y0 === "number") extra.push(String(y0), `${y0}`);
  if (typeof y0 === "string") extra.push(y0, y0.trim());
  return extra;
}

function resolveMatchedSearchKey(
  digest: string,
  o: Record<string, unknown>,
  titles: string[],
  years: string[],
): string | null {
  const primary = matchLogicalKey(digest, titles, years, "UY");
  if (primary) return primary;
  const combined = new Set([...years, ...extraYearStrings(o.year)]);
  return matchLogicalKey(digest, titles, [...combined], "UY");
}

function parseSearchEntryOrExit(
  row: { key: string; value: string },
  seen: Set<string>,
): SearchEntry | null {
  const digest = extractDigest(row.key);
  if (!digest) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) return null;
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (!isSearchPayload(o)) return null;

  const titles = titleCandidates(o as { title?: string });
  if (!titles.length) return null;

  const years = yearCandidates(o.year);
  const matchedKey = resolveMatchedSearchKey(digest, o, titles, years);
  if (!matchedKey) {
    console.error("Could not reverse cache key for", digest, o.title);
    process.exit(1);
  }
  const m = /^search-movie:(.*):(.*):UY$/.exec(matchedKey);
  if (!m) {
    console.error("bad matchedKey", matchedKey);
    process.exit(1);
  }
  const reqTitle = m[1];
  const reqYearRaw = m[2];
  const sig = `${reqTitle}\0${reqYearRaw}\0es_UY`;
  if (seen.has(sig)) return null;
  seen.add(sig);
  return {
    request: {
      title: reqTitle,
      year: reqYearRaw === "" ? "" : reqYearRaw,
      country: "es_UY",
    },
    response: parsed,
  };
}

function collectSearchEntries(snap: { keys: { key: string; value: string }[] }): SearchEntry[] {
  const searchEntries: SearchEntry[] = [];
  const seen = new Set<string>();
  for (const row of snap.keys) {
    const entry = parseSearchEntryOrExit(row, seen);
    if (entry) searchEntries.push(entry);
  }
  return searchEntries;
}

type ListFilm = { title: string; year: string; link: string; poster: null };

function findBestListFilms(snap: { keys: { key: string; value: string }[] }): ListFilm[] | null {
  let bestArr: ListFilm[] | null = null;
  for (const row of snap.keys) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) continue;
    const first = parsed[0];
    if (!first || typeof first !== "object") continue;
    const f = first as Record<string, unknown>;
    if (typeof f.title !== "string" || typeof f.link !== "string") continue;
    if (!bestArr || parsed.length > bestArr.length) {
      bestArr = parsed as ListFilm[];
    }
  }
  return bestArr;
}

function sortSearchEntries(entries: SearchEntry[]): void {
  entries.sort((a, b) => {
    const t = a.request.title.localeCompare(b.request.title);
    if (t) return t;
    return String(a.request.year).localeCompare(String(b.request.year));
  });
}

function writeApiFixtures(searchEntries: SearchEntry[], bestArr: ListFilm[]): void {
  const letterboxdFixture = [
    {
      request: {
        listUrl: "https://letterboxd.com/shoemonger/watchlist/",
        country: "es_UY",
        username: "shoemonger",
        listType: "watchlist",
        page: 1,
      },
      response: {
        message: "List found",
        watchlist: bestArr,
        lastPage: 1,
        totalPages: 1,
      },
    },
  ];

  const outDir = path.join(rootDir, "tests", "fixtures", "api");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "search-movie.json"),
    `${JSON.stringify(searchEntries, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, "letterboxd-watchlist.json"),
    `${JSON.stringify(letterboxdFixture, null, 2)}\n`,
  );
}

function main(): void {
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const snap = JSON.parse(raw) as { keys: { key: string; value: string }[] };

  const searchEntries = collectSearchEntries(snap);
  sortSearchEntries(searchEntries);

  const bestArr = findBestListFilms(snap);
  if (!bestArr) {
    console.error("No list array found in snapshot");
    process.exit(1);
  }

  writeApiFixtures(searchEntries, bestArr);

  console.log(`[sync-api-fixtures] search-movie entries: ${searchEntries.length}`);
  console.log(`[sync-api-fixtures] letterboxd watchlist films: ${bestArr.length}`);
}

main();
