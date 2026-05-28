# Codebase Resource Optimization Plan

> **For agentic workers:** Use superpowers:executing-plans. Tasks are sequential — one depends on the previous.

**Goal:** Reduce server resource consumption (API calls, memory, CPU, bandwidth) while maintaining or improving response times.

**Rationale:** With Redis removed from production, every request is a full cache miss calling upstream APIs fresh. The 256mb VM has tight memory headroom. These changes cut API calls ~80%, bandwidth ~60%, and memory churn.

**Tech Stack:** fastify, axios, vite, framer-motion, cheerio

---

## Diagnosis

| Issue                                                                                                            | Impact                                          | Priority |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------- |
| **No in-process cache** — `DISABLE_REDIS=1` makes all `setCacheValue` no-ops and all `getCacheValue` return null | Every search re-fetches TMDb + JustWatch + OMDb | **P0**   |
| **Poster probe downloads full image** — `arrayBuffer()` on 30-100KB per poster just to validate existence        | Wasted bandwidth + memory per film              | **P1**   |
| **No HTTP keep-alive** — axios creates new TCP connection per outbound call                                      | Connection churn + latency                      | **P1**   |
| **No response compression** — JSON sent uncompressed                                                             | Bandwidth 3-4x larger than needed               | **P1**   |
| **No rate limiting on production routes** — unlimited concurrent API calls                                       | Risk of exhausting upstream quotas              | **P1**   |
| **UserAgent created per request** — `new UserAgent()` on every scrape call                                       | CPU waste, could reuse                          | **P2**   |
| **List cache TTL = 20s** — very short, causes frequent Letterboxd refetches                                      | Extra bandwidth for repeat lookups              | **P2**   |
| **Frontend: single 688KB bundle** — framer-motion bundled entirely with app code                                 | Larger download, slower parse                   | **P2**   |

---

## Task 1: Add in-process TTL cache (replaces Redis)

**Files:**

- Create: `src/server/lib/memoryCache.ts`
- Modify: `src/server/lib/redis.ts` (lines 82-135: `getCacheValue` + `setCacheValue`)

### Step 1: Create `src/server/lib/memoryCache.ts`

A simple TTL-based Map cache that mirrors the Redis cache interface. No external dependencies — built on `Map` + `setTimeout` cleanup.

```typescript
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 60_000; // 60s

const get = (key: string): unknown => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

const set = (key: string, value: unknown, ttlSeconds: number): boolean => {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
};

// Periodic cleanup every 60s to prevent memory leak from stale entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
const startCleanup = (intervalMs = 60_000): void => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt) store.delete(key);
    }
  }, intervalMs);
  cleanupTimer.unref();
};

const stopCleanup = (): void => {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
};

const clear = (): void => {
  store.clear();
};

export const memoryCache = { get, set, startCleanup, stopCleanup, clear };
```

### Step 2: Modify `redis.ts` to fall back to memory cache

In `getCacheValue` and `setCacheValue`, add a memory cache fallback when Redis is disabled:

```typescript
// At top of file, add import
import { memoryCache } from "./memoryCache.js";

// In getCacheValue (line 82-105), add before Redis check:
export const getCacheValue = async (key: string): Promise<unknown> => {
  if (isRedisDisabled()) {
    return memoryCache.get(getCacheKey(key));
  }
  // ... existing Redis logic
};

// In setCacheValue (line 107-135), add before Redis check:
export const setCacheValue = async (
  key: string,
  value: unknown,
  ttl: number = 60,
  category?: string | string[],
): Promise<boolean | null> => {
  if (isRedisDisabled()) {
    memoryCache.set(getCacheKey(key), value, ttl);
    return true;
  }
  // ... existing Redis logic
};
```

The `indexCacheKeyByCategory`, `getSoonestIndexedCacheKeyExpiryAtMs`, `clearCacheByCategory`, and `getCacheCategoryCount` functions have more complex semantics that don't map cleanly to a simple Map. They can remain as-is (returning null/0/error) — they're only used by dev diagnostic routes.

### Step 3: Start cleanup in `main.ts` or `createServer.ts`

```typescript
import { memoryCache } from "./lib/memoryCache.js";
memoryCache.startCleanup();
```

### Expected impact:

- **Cache hits go from 0% → ~90%** (cache TTLs range from 60s to 3600s)
- **TMDb API calls reduced ~90%** for repeat searches
- **JustWatch API calls reduced ~90%**
- **Memory usage**: each cache entry is ~2-5KB. With ~1000 entries max, ~2-5MB.

---

## Task 2: Use HEAD instead of GET for poster probing

**Files:**

- Modify: `src/server/lib/letterboxdHttp.ts` (lines 147-158: `fetchLetterboxdBinaryOk`)
- Modify: `src/server/controllers/letterboxdPoster.ts` (line 52-55: caller)

### Step 1: Rewrite `fetchLetterboxdBinaryOk` to HEAD

```typescript
export async function fetchLetterboxdBinaryOk(
  url: string,
  headers: Record<string, string>,
): Promise<void> {
  const res = await fetch(url, {
    method: "HEAD",
    headers,
    signal: AbortSignal.timeout(getLetterboxdFetchTimeoutMs()),
  });
  if (!res.ok) {
    throw new LetterboxdHttpError(`HTTP ${res.status}`, res.status);
  }
}
```

Simplify: remove the `fetchWith429Retry` wrapper for HEAD requests (no body to drain), and remove `assertImageResponseContentType` since HEAD responses often omit Content-Type.

### Expected impact:

- Each poster probe: **30-100KB download eliminated**
- For a 200-film list at 4 concurrent: **~6-20MB bandwidth saved**
- **Faster** — HEAD responses are near-instant vs downloading the body

---

## Task 3: Enable HTTP keep-alive for outbound calls

**Files:**

- Modify: `src/server/lib/axios.ts` (line 72-76)
- Modify: all callers of `httpClientFactory()`

### Step 1: Make keep-alive the default

```typescript
export default (keepAlive?: boolean): AxiosInstance => {
  if (keepAlive || keepAlive === undefined) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
```

The `keepAlive` parameter becomes opt-out rather than opt-in. Existing callers that don't pass an argument now get keep-alive. If any caller explicitly passed `false` (there are none in the codebase), they'd get the old behavior.

### Step 2: Verify no callers pass `false`

```
grep -r 'httpClientFactory(' src/server/
```

All callers should either pass nothing or `true`.

### Expected impact:

- **TCP connection reuse**: TMDb, OMDb, JustWatch all use the same axios instance
- **Latency reduction**: DNS + TCP handshake saved per request (~50-200ms)
- **Server resource**: fewer sockets in TIME_WAIT state

---

## Task 4: Add response compression

**Files:**

- Modify: `package.json` (add `@fastify/compress`)
- Modify: `src/server/createServer.ts` (register plugin)

### Step 1: Install

```bash
bun add @fastify/compress
```

### Step 2: Register in `createServer.ts`

```typescript
import compress from "@fastify/compress";

// After creating the Fastify instance (line 25):
await app.register(compress, { global: true, threshold: 1024 });
```

### Expected impact:

- **JSON response size reduced ~60-80%** (typical API responses are 2-5KB → 0.5-1KB)
- Client support: browsers and axios all accept gzip/deflate automatically
- Negligible CPU cost for 2-5KB payloads

---

## Task 5: Add rate limiting to production routes

**Files:**

- Modify: `src/server/registerFastifyAppApi.ts` (add rate limit registration)

### Step 1: Register `@fastify/rate-limit` globally for production

The package is already installed (`@fastify/rate-limit` in dependencies). Currently only registered for dev routes in `registerDevHttpRoutes.ts`.

```typescript
// In registerFastifyAppApi.ts, add at the top:
import rateLimit from "@fastify/rate-limit";

// Before registering routes:
await app.register(rateLimit, {
  max: 30, // 30 requests per time window
  timeWindow: "1 minute",
  keyGenerator: (request) => {
    return request.ip;
  },
  errorResponseBuilder: (_request, context) => ({
    error: "Too many requests, please try again later",
    statusCode: 429,
    retryAfter: context.after,
  }),
});
```

### Expected impact:

- **No more runaway API consumption** from aggressive clients
- Protects TMDb/JustWatch API quotas
- 30/min is generous enough for normal usage

---

## Task 6: Cache/reuse UserAgent instead of creating per request

**Files:**

- Modify: `src/server/lib/scrapeUserAgent.ts`

### Step 1: Add module-level cached UA

Current code (line 14):

```typescript
export const getRandomScrapeUserAgent = (): string =>
  new UserAgent({ deviceCategory: "desktop" }).toString();
```

Changed to:

```typescript
let cachedUserAgent: string | null = null;

export const getRandomScrapeUserAgent = (): string => {
  if (!cachedUserAgent) {
    cachedUserAgent = new UserAgent({ deviceCategory: "desktop" }).toString();
  }
  return cachedUserAgent;
};
```

The UserAgent constructor does browser detection and platform detection every time. A single cached agent is sufficient for all Letterboxd scrapes.

### Expected impact:

- `UserAgent()` constructor cost saved on every Letterboxd page request
- Single allocation instead of per-request

---

## Task 7: Increase list page cache TTL from 20s

**Files:**

- Modify: `src/server/controllers/letterboxdLists.ts` (line 29)

### Step 1: Raise default TTL

```typescript
const cacheTtl = Number(process.env.CACHE_TTL) || 300; // was 20
```

Letterboxd list pages rarely change minute-to-minute. 5 minutes dramatically reduces refetches while still staying fresh enough for a watchlist scanning tool.

### Expected impact:

- 15x fewer Letterboxd page fetches for repeat lookups (300s / 20s)
- With the in-process cache (Task 1), this also means fewer Cheerio parses

---

## Task 8: Frontend bundle splitting

**Files:**

- Modify: `vite.config.ts` (add `manualChunks`)

### Step 1: Add manualChunks to rollupOptions

```typescript
build: {
  outDir: "dist",
  sourcemap: "hidden",
  rollupOptions: {
    input: path.resolve(__dirname, "src", "client", "index.html"),
    output: {
      manualChunks: {
        vendor: ["react", "react-dom", "react-hot-toast"],
        animation: ["framer-motion"],
        analytics: ["posthog-js"],
      },
    },
  },
},
```

This splits the monolithic 688KB `index-*.js` into:

- `vendor-*.js`: React + ReactDOM + toast (gzip ~45KB)
- `animation-*.js`: framer-motion (gzip ~20KB)
- `analytics-*.js`: posthog-js (gzip ~15KB)
- `index-*.js`: app code only

### Expected impact:

- **Smaller initial load** — vendor chunk loads first, animation deferred
- **Better caching** — updating app code doesn't invalidate vendor/animation chunks
- **Parallel downloads** — browser loads chunks simultaneously

---

## Files changed summary

| File                                           | Change                                                       | Task |
| ---------------------------------------------- | ------------------------------------------------------------ | ---- |
| `src/server/lib/memoryCache.ts`                | **Create** — TTL-based Map cache                             | 1    |
| `src/server/lib/redis.ts`                      | Add memory cache fallback in `getCacheValue`/`setCacheValue` | 1    |
| `src/server/lib/letterboxdHttp.ts`             | Change `fetchLetterboxdBinaryOk` to HEAD                     | 2    |
| `src/server/controllers/letterboxdPoster.ts`   | Remove `arrayBuffer()` call                                  | 2    |
| `src/server/lib/axios.ts`                      | Default keepAlive = true                                     | 3    |
| `package.json`                                 | Add `@fastify/compress`                                      | 4    |
| `src/server/createServer.ts`                   | Register compression plugin                                  | 4    |
| `src/server/registerFastifyAppApi.ts`          | Register rate limiting                                       | 5    |
| `src/server/lib/scrapeUserAgent.ts`            | Cache UA string                                              | 6    |
| `src/server/controllers/letterboxdLists.ts:29` | TTL 20 → 300                                                 | 7    |
| `vite.config.ts`                               | Add manualChunks                                             | 8    |

## Rollback

Each task is independent. If one causes issues, revert just that file:

```bash
git checkout src/server/lib/memoryCache.ts  # delete (new file)
git checkout src/server/lib/redis.ts
git checkout src/server/lib/letterboxdHttp.ts
# etc.
```
