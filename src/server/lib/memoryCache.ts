interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/**
 * Count cap on the in-process fallback cache. This is a safety ceiling against
 * unbounded growth on the 256MB VM (entry sizes vary widely, so it is a count
 * bound, not a precise memory bound), not a tuned working-set size. Override via
 * MEMORY_CACHE_MAX_ENTRIES.
 */
const maxEntries = Number(process.env.MEMORY_CACHE_MAX_ENTRIES) || 2000;

const get = (key: string): unknown => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // LRU touch: re-insert so this key becomes the most-recently-used (Map
  // preserves insertion order, so the oldest key is evicted first in set()).
  store.delete(key);
  store.set(key, entry);
  return entry.value;
};

const set = (key: string, value: unknown, ttlSeconds: number): boolean => {
  // Evict oldest entries until there is room. Deleting an existing key first
  // keeps the cap honest when overwriting.
  store.delete(key);
  while (store.size >= maxEntries) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
};

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
