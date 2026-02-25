import type { CanonicalProviderMap, MovieProvider } from "../types/index.js";
import type { JustWatchOffer } from "../types/index.js";

export function processOffers(
  offers: JustWatchOffer[],
  fullPath: string,
  canonicalMap?: CanonicalProviderMap | null
): MovieProvider[] {
  const byId = new Map<
    string,
    { id: string; name: string; icon: string; url: string; urls: string[]; type: string }
  >();
  for (const offer of offers) {
    if (!["FLATRATE", "FREE", "ADS"].includes(offer.monetizationType)) continue;
    const rawId = offer.package.technicalName;
    const canonical = canonicalMap?.[rawId] ?? { id: rawId, name: offer.package.clearName };
    const id = canonical.id;
    const name = canonical.name;
    if (byId.has(id)) {
      const existing = byId.get(id)!;
      const url = offer.standardWebURL || fullPath;
      if (url && !existing.urls.includes(url)) existing.urls.push(url);
      continue;
    }
    const url = offer.standardWebURL || fullPath;
    byId.set(id, {
      id,
      name,
      icon: `https://images.justwatch.com${offer.package.icon
        .replace("{profile}", "s100")
        .replace("{format}", "jpg")}`,
      url,
      urls: [url],
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
