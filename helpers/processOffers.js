/**
 * Deduplicate JustWatch offers by package id (technicalName), optionally using a canonical map.
 * When canonicalMap is provided, each offer is mapped to canonical id/name before deduping.
 * Same package with different URLs is merged into one provider (first URL used).
 * Only FLATRATE, FREE, ADS monetization types are included.
 * @param {object} [canonicalMap] - Optional map technicalName → { id, name } (canonical)
 */
export function processOffers(offers, fullPath, canonicalMap) {
  const byId = new Map();
  for (const offer of offers) {
    if (!["FLATRATE", "FREE", "ADS"].includes(offer.monetizationType)) continue;
    const rawId = offer.package.technicalName;
    const canonical = canonicalMap?.[rawId] ?? { id: rawId, name: offer.package.clearName };
    const id = canonical.id;
    const name = canonical.name;
    if (byId.has(id)) {
      const existing = byId.get(id);
      const url = offer.standardWebURL || fullPath;
      if (url && !existing.urls.includes(url)) existing.urls.push(url);
      continue;
    }
    byId.set(id, {
      id,
      name,
      icon: `https://images.justwatch.com${offer.package.icon
        .replace("{profile}", "s100")
        .replace("{format}", "jpg")}`,
      url: offer.standardWebURL || fullPath,
      urls: [offer.standardWebURL || fullPath],
      type: offer.monetizationType,
    });
  }
  return Array.from(byId.values()).map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    url: p.urls[0],
    type: p.type,
  }));
}
