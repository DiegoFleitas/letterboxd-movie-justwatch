/**
 * Provider normalization and filter matching using gathered canonical data when available.
 * When window.__CANONICAL_PROVIDERS_BY_NAME__ is set (from build), use it for grouping and matching.
 */

function getCanonicalByNames() {
  return typeof window !== "undefined" ? window.__CANONICAL_PROVIDERS_BY_NAME__ : null;
}

/**
 * Normalize display name to a canonical key (for grouping/filtering).
 * Uses gathered data when available; otherwise returns the name as-is (exact match).
 */
export function normalizedProviderKey(name) {
  if (!name || typeof name !== "string") return "";
  const byName = getCanonicalByNames();
  if (byName && byName[name]) return byName[name].id;
  return name;
}

/**
 * Deduplicate providers for the bar: one entry per canonical id when map is present.
 * Uses gathered byClearName data; otherwise returns the list as-is.
 */
export function deduplicateProviderList(providers) {
  const all = Array.isArray(providers) ? providers.filter((p) => p?.name) : [];
  const byName = getCanonicalByNames();
  if (!byName || !Object.keys(byName).length) return all;
  const byCanonicalId = new Map();
  for (const p of all) {
    const canonical = byName[p.name];
    const id = canonical ? canonical.id : p.id;
    if (!byCanonicalId.has(id)) byCanonicalId.set(id, p);
    else if (canonical && canonical.name === p.name) byCanonicalId.set(id, p);
  }
  return Array.from(byCanonicalId.values());
}

/**
 * Returns true if a tile with the given provider names should be visible
 * when the user has selected the given filter names.
 * Uses canonical id when map is present; otherwise exact name match.
 */
export function tileMatchesProviderFilter(tileProviderNames, activeFilterNames) {
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
