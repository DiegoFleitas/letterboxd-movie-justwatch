/**
 * Regenerate tests/fixtures/api/*.json from redis/data/redis-snapshot.json.
 * Run: bun scripts/syncApiFixturesFromRedisSnapshot.ts
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
  const out: string[] = [];
  if (year === undefined || year === null) {
    out.push("");
  } else {
    out.push(String(year));
  }
  return [...new Set(out)];
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

function main(): void {
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const snap = JSON.parse(raw) as { keys: { key: string; value: string }[] };

  const searchEntries: SearchEntry[] = [];
  const seen = new Set<string>();

  for (const row of snap.keys) {
    const digest = extractDigest(row.key);
    if (!digest) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (Array.isArray(parsed)) continue;

    if (!parsed || typeof parsed !== "object") continue;
    const o = parsed as Record<string, unknown>;
    const hasProviders = Array.isArray(o.movieProviders);
    const hasSearchError = typeof o.error === "string" && "title" in o;
    if (!hasProviders && !hasSearchError) continue;

    const titles = titleCandidates(o as { title?: string });
    if (!titles.length) continue;

    const years = yearCandidates(o.year);
    const country = "UY";
    let matchedKey: string | null = null;
    outer: for (const title of titles) {
      for (const y of years) {
        const logical = `search-movie:${title}:${y}:${country}`;
        if (digestOf(logical) === digest) {
          matchedKey = logical;
          break outer;
        }
      }
    }
    if (!matchedKey) {
      const y0 = o.year;
      const extra: string[] = [];
      if (typeof y0 === "number") extra.push(String(y0), `${y0}`);
      if (typeof y0 === "string") extra.push(y0, y0.trim());
      for (const y of [...new Set([...years, ...extra])]) {
        for (const title of titles) {
          const logical = `search-movie:${title}:${y}:${country}`;
          if (digestOf(logical) === digest) {
            matchedKey = logical;
            break;
          }
        }
        if (matchedKey) break;
      }
    }
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
    if (seen.has(sig)) continue;
    seen.add(sig);
    searchEntries.push({
      request: {
        title: reqTitle,
        year: reqYearRaw === "" ? "" : reqYearRaw,
        country: "es_UY",
      },
      response: parsed,
    });
  }

  searchEntries.sort((a, b) => {
    const t = a.request.title.localeCompare(b.request.title);
    if (t) return t;
    return String(a.request.year).localeCompare(String(b.request.year));
  });

  type ListFilm = { title: string; year: string; link: string; poster: null };
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

  if (!bestArr) {
    console.error("No list array found in snapshot");
    process.exit(1);
  }

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

  console.log(`[sync-api-fixtures] search-movie entries: ${searchEntries.length}`);
  console.log(`[sync-api-fixtures] letterboxd watchlist films: ${bestArr.length}`);
}

main();
