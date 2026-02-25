import type { CanonicalProviderMap } from "../types/index.js";

interface PackageItem {
  technicalName: string;
  clearName?: string | null;
}

function normalizedProviderKey(clearName: string | null | undefined): string {
  if (!clearName || typeof clearName !== "string") return "";
  return clearName
    .replace(/\s+Amazon\s+Channel\s*$/i, "")
    .replace(/\s+Standard\s+with\s+Ads\s*$/i, "")
    .replace(/\s+with\s+Ads\s*$/i, "")
    .replace(/\s+Premium\s*$/i, "")
    .trim()
    .toLowerCase();
}

function preferMainName(clearName: string): boolean {
  return !/\s+Amazon\s+Channel\s*$/i.test(clearName);
}

export function buildCanonicalProviderMap(packages: PackageItem[]): CanonicalProviderMap {
  const { byTechnicalName } = buildCanonicalProviderMaps(packages);
  return byTechnicalName;
}

export function buildCanonicalProviderMaps(packages: PackageItem[]): {
  byTechnicalName: CanonicalProviderMap;
  byClearName: Record<string, { id: string; name: string }>;
} {
  const list = Array.isArray(packages) ? packages.filter((p) => p?.technicalName != null) : [];
  const byKey = new Map<string, { id: string; name: string }>();
  for (const p of list) {
    const key = normalizedProviderKey(p.clearName);
    if (!key) continue;
    const existing = byKey.get(key);
    const canonical = { id: p.technicalName, name: p.clearName || p.technicalName };
    if (!existing) {
      byKey.set(key, canonical);
    } else if (preferMainName(p.clearName ?? "") && !preferMainName(existing.name)) {
      byKey.set(key, canonical);
    }
  }
  const byTechnicalName: CanonicalProviderMap = {};
  const byClearName: Record<string, { id: string; name: string }> = {};
  for (const p of list) {
    const key = normalizedProviderKey(p.clearName);
    if (!key) continue;
    const canonical = byKey.get(key);
    if (canonical) {
      byTechnicalName[p.technicalName] = { id: canonical.id, name: canonical.name };
      byClearName[p.clearName ?? p.technicalName] = { id: canonical.id, name: canonical.name };
    }
  }
  return { byTechnicalName, byClearName };
}
