/**
 * Tests for provider deduplication: backend processOffers and canonical map builder.
 */
import { describe, it, expect } from "vitest";
import { processOffers } from "../helpers/processOffers.js";
import {
  buildCanonicalProviderMap,
  buildCanonicalProviderMaps,
} from "../helpers/canonicalProviders.js";
import {
  tileMatchesProviderFilter,
  normalizedProviderKey,
  deduplicateProviderList,
} from "../public/src/providerUtils.js";

function makeOffer(
  technicalName: string,
  clearName: string,
  monetizationType: string = "FLATRATE",
  standardWebURL: string = "https://example.com/a",
): {
  monetizationType: string;
  standardWebURL?: string;
  package: { technicalName: string; clearName: string; icon: string };
} {
  return {
    monetizationType,
    standardWebURL,
    package: {
      technicalName,
      clearName,
      icon: "https://images.justwatch.com/icon{sprofile}{sformat}.jpg",
    },
  };
}

describe("Provider deduplication", () => {
  it("processOffers returns one provider per unique id", () => {
    const offers = [
      makeOffer("disneyplus", "Disney Plus", "FLATRATE", "https://a.com/1"),
      makeOffer("disneyplus", "Disney Plus", "FLATRATE", "https://a.com/2"),
    ];
    const result = processOffers(offers, "https://fallback.com");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("disneyplus");
    expect(result[0].name).toBe("Disney Plus");
    expect(result[0].url).toBe("https://a.com/1");
  });

  it("processOffers returns multiple providers for different ids when no map", () => {
    const offers = [makeOffer("max", "HBO Max"), makeOffer("amazonmax", "HBO Max  Amazon Channel")];
    const result = processOffers(offers, "https://f.com");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("max");
    expect(result[1].id).toBe("amazonmax");
  });

  it("processOffers includes only FLATRATE, FREE, ADS", () => {
    const offers = [
      makeOffer("netflix", "Netflix", "FLATRATE"),
      makeOffer("rent", "Rent", "RENT"),
      makeOffer("free", "Free", "FREE"),
    ];
    const result = processOffers(offers, "https://f.com");
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.id === "netflix")).toBe(true);
    expect(result.some((p) => p.id === "free")).toBe(true);
    expect(result.some((p) => p.id === "rent")).toBe(false);
  });

  it("processOffers uses fullPath when standardWebURL missing", () => {
    const offer = makeOffer("plex", "Plex");
    delete offer.standardWebURL;
    const result = processOffers([offer], "https://fallback.com/path");
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://fallback.com/path");
  });

  it("processOffers with canonicalMap merges same brand into one", () => {
    const offers = [makeOffer("max", "HBO Max"), makeOffer("amazonmax", "HBO Max  Amazon Channel")];
    const canonicalMap = {
      max: { id: "max", name: "HBO Max" },
      amazonmax: { id: "max", name: "HBO Max" },
    };
    const result = processOffers(offers, "https://f.com", canonicalMap);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("max");
    expect(result[0].name).toBe("HBO Max");
  });

  it("processOffers with empty map behaves like no map", () => {
    const offers = [makeOffer("max", "HBO Max"), makeOffer("amazonmax", "HBO Max  Amazon Channel")];
    const result = processOffers(offers, "https://f.com", {});
    expect(result).toHaveLength(2);
  });

  it("buildCanonicalProviderMap maps same brand to one canonical", () => {
    const packages = [
      { technicalName: "max", clearName: "HBO Max" },
      { technicalName: "amazonmax", clearName: "HBO Max  Amazon Channel" },
    ];
    const map = buildCanonicalProviderMap(packages);
    expect(map.max?.id).toBe("max");
    expect(map.max?.name).toBe("HBO Max");
    expect(map.amazonmax?.id).toBe("max");
    expect(map.amazonmax?.name).toBe("HBO Max");
  });

  it("buildCanonicalProviderMap handles empty input", () => {
    const map = buildCanonicalProviderMap([]);
    expect(Object.keys(map).length).toBe(0);
  });

  it("buildCanonicalProviderMaps returns byClearName for data-driven normalization", () => {
    const packages = [
      { technicalName: "max", clearName: "HBO Max" },
      { technicalName: "amazonmax", clearName: "HBO Max  Amazon Channel" },
    ];
    const { byClearName } = buildCanonicalProviderMaps(packages);
    expect(byClearName["HBO Max"]?.id).toBe("max");
    expect(byClearName["HBO Max  Amazon Channel"]?.id).toBe("max");
    expect(byClearName["HBO Max  Amazon Channel"]?.name).toBe("HBO Max");
  });

  it("tileMatchesProviderFilter exact match", () => {
    expect(tileMatchesProviderFilter(["HBO Max"], ["HBO Max"])).toBe(true);
    expect(tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"])).toBe(false);
  });

  it("tileMatchesProviderFilter returns true when no active filters", () => {
    expect(tileMatchesProviderFilter(["Netflix"], [])).toBe(true);
  });

  it("tileMatchesProviderFilter returns false when tile has no providers", () => {
    expect(tileMatchesProviderFilter([], ["Netflix"])).toBe(false);
  });

  it("normalizedProviderKey uses map when window.__CANONICAL_PROVIDERS_BY_NAME__ is set", () => {
    const map = {
      "HBO Max": { id: "max", name: "HBO Max" },
      "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
    };
    const prev = (globalThis as { window?: unknown }).window;
    (
      globalThis as {
        window?: { __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }> };
      }
    ).window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
    try {
      expect(normalizedProviderKey("HBO Max")).toBe("max");
      expect(normalizedProviderKey("HBO Max  Amazon Channel")).toBe("max");
      expect(normalizedProviderKey("Netflix")).toBe("Netflix");
    } finally {
      (globalThis as { window?: unknown }).window = prev;
    }
  });

  it("deduplicateProviderList collapses by canonical id when map is set", () => {
    const map = {
      "HBO Max": { id: "max", name: "HBO Max" },
      "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
    };
    const prev = (globalThis as { window?: unknown }).window;
    (
      globalThis as {
        window?: { __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }> };
      }
    ).window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
    try {
      const providers = [
        { id: "max", name: "HBO Max", icon: "https://a" },
        { id: "amazonmax", name: "HBO Max  Amazon Channel", icon: "https://b" },
      ];
      const result = deduplicateProviderList(providers);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("max");
    } finally {
      (globalThis as { window?: unknown }).window = prev;
    }
  });

  it("tileMatchesProviderFilter matches by canonical id when map is set", () => {
    const map = {
      "HBO Max": { id: "max", name: "HBO Max" },
      "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
    };
    const prev = (globalThis as { window?: unknown }).window;
    (
      globalThis as {
        window?: { __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }> };
      }
    ).window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
    try {
      expect(tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"])).toBe(true);
      expect(tileMatchesProviderFilter(["HBO Max"], ["HBO Max  Amazon Channel"])).toBe(true);
    } finally {
      (globalThis as { window?: unknown }).window = prev;
    }
  });
});
