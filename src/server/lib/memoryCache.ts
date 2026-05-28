interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

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
