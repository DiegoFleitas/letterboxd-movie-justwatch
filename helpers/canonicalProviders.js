/**
 * Build a canonical provider map from GetPackages data (used by build script only).
 * Same normalization rules as the former frontend: same brand → one canonical id/name.
 */

/** Normalize clearName to a key for grouping (strip suffixes, lowercase). */
function normalizedProviderKey(clearName) {
  if (!clearName || typeof clearName !== "string") return "";
  return clearName
    .replace(/\s+Amazon\s+Channel\s*$/i, "")
    .replace(/\s+Standard\s+with\s+Ads\s*$/i, "")
    .replace(/\s+with\s+Ads\s*$/i, "")
    .replace(/\s+Premium\s*$/i, "")
    .trim()
    .toLowerCase();
}

function preferMainName(clearName) {
  return !/\s+Amazon\s+Channel\s*$/i.test(clearName);
}

/**
 * Build map technicalName → { id, name } (canonical).
 * Input: array of { technicalName, clearName } from GetPackages.
 * Groups by normalized clearName; picks one canonical id/name per group (prefer main over "X Amazon Channel").
 * @param {Array<{ technicalName: string, clearName: string }>} packages
 * @returns {Record<string, { id: string, name: string }>}
 */
export function buildCanonicalProviderMap(packages) {
  const { byTechnicalName } = buildCanonicalProviderMaps(packages);
  return byTechnicalName;
}

/**
 * Build both byTechnicalName and byClearName from gathered package data.
 * byClearName maps every seen clearName → canonical { id, name } for data-driven normalization.
 */
export function buildCanonicalProviderMaps(packages) {
  const list = Array.isArray(packages) ? packages.filter((p) => p?.technicalName != null) : [];
  const byKey = new Map();
  for (const p of list) {
    const key = normalizedProviderKey(p.clearName);
    if (!key) continue;
    const existing = byKey.get(key);
    const canonical = { id: p.technicalName, name: p.clearName || p.technicalName };
    if (!existing) {
      byKey.set(key, canonical);
    } else if (preferMainName(p.clearName) && !preferMainName(existing.name)) {
      byKey.set(key, canonical);
    }
  }
  const byTechnicalName = {};
  const byClearName = {};
  for (const p of list) {
    const key = normalizedProviderKey(p.clearName);
    if (!key) continue;
    const canonical = byKey.get(key);
    if (canonical) {
      byTechnicalName[p.technicalName] = { id: canonical.id, name: canonical.name };
      byClearName[p.clearName] = { id: canonical.id, name: canonical.name };
    }
  }
  return { byTechnicalName, byClearName };
}
