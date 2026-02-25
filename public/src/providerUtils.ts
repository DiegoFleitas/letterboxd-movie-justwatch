/// <reference path="./vite-env.d.ts" />
/**
 * Provider normalization and filter matching using gathered canonical data when available.
 */
type CanonicalByNames = Record<string, { id: string; name: string }>;

function getCanonicalByNames(): CanonicalByNames | null | undefined {
  return typeof window !== "undefined" ? window.__CANONICAL_PROVIDERS_BY_NAME__ : null;
}

export function normalizedProviderKey(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  const byName = getCanonicalByNames();
  if (byName && byName[name]) return byName[name].id;
  return name;
}

export interface ProviderLike {
  id: string;
  name: string;
  icon?: string;
}

export function deduplicateProviderList(providers: ProviderLike[]): ProviderLike[] {
  const all = Array.isArray(providers) ? providers.filter((p) => p?.name) : [];
  const byName = getCanonicalByNames();
  if (!byName || !Object.keys(byName).length) return all;
  const byCanonicalId = new Map<string, ProviderLike>();
  for (const p of all) {
    const canonical = byName[p.name];
    const id = canonical ? canonical.id : p.id;
    if (!byCanonicalId.has(id)) byCanonicalId.set(id, p);
    else if (canonical && canonical.name === p.name) byCanonicalId.set(id, p);
  }
  return Array.from(byCanonicalId.values());
}

export function tileMatchesProviderFilter(
  tileProviderNames: string[],
  activeFilterNames: string[]
): boolean {
  if (!Array.isArray(activeFilterNames) || activeFilterNames.length === 0) return true;
  const names = Array.isArray(tileProviderNames) ? tileProviderNames : [];
  if (names.length === 0) return false;
  const byName = getCanonicalByNames();
  if (byName && Object.keys(byName).length > 0) {
    const activeIds = new Set(activeFilterNames.map((n) => normalizedProviderKey(n)));
    return names.some((n) => activeIds.has(normalizedProviderKey(n)));
  }
  return activeFilterNames.some((f) => names.includes(f));
}
