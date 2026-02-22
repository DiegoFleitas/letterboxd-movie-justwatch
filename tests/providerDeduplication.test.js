/**
 * Tests for provider deduplication: backend processOffers (with/without canonical map)
 * and canonical map builder. Frontend uses exact name match when no map; data-driven when map present.
 */

import { TestSuite, assertEqual, assertArrayLength, assert } from "./testUtils.js";
import { processOffers } from "../helpers/processOffers.js";
import { buildCanonicalProviderMap, buildCanonicalProviderMaps } from "../helpers/canonicalProviders.js";
import {
  tileMatchesProviderFilter,
  normalizedProviderKey,
  deduplicateProviderList,
} from "../public/src/providerUtils.js";

const suite = new TestSuite("Provider deduplication");

function makeOffer(
  technicalName,
  clearName,
  monetizationType = "FLATRATE",
  standardWebURL = "https://example.com/a"
) {
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

// --- processOffers (no map) ---

suite.test("processOffers returns one provider per unique id", () => {
  const offers = [
    makeOffer("disneyplus", "Disney Plus", "FLATRATE", "https://a.com/1"),
    makeOffer("disneyplus", "Disney Plus", "FLATRATE", "https://a.com/2"),
  ];
  const result = processOffers(offers, "https://fallback.com");
  assertArrayLength(result, 1, "Same id should yield one provider");
  assertEqual(result[0].id, "disneyplus");
  assertEqual(result[0].name, "Disney Plus");
  assertEqual(result[0].url, "https://a.com/1", "First URL should be used");
});

suite.test("processOffers returns multiple providers for different ids when no map", () => {
  const offers = [
    makeOffer("max", "HBO Max"),
    makeOffer("amazonmax", "HBO Max  Amazon Channel"),
  ];
  const result = processOffers(offers, "https://f.com");
  assertArrayLength(result, 2);
  assertEqual(result[0].id, "max");
  assertEqual(result[1].id, "amazonmax");
});

suite.test("processOffers includes only FLATRATE, FREE, ADS", () => {
  const offers = [
    makeOffer("netflix", "Netflix", "FLATRATE"),
    makeOffer("rent", "Rent", "RENT"),
    makeOffer("free", "Free", "FREE"),
  ];
  const result = processOffers(offers, "https://f.com");
  assertArrayLength(result, 2);
  assert(result.some((p) => p.id === "netflix"));
  assert(result.some((p) => p.id === "free"));
  assert(!result.some((p) => p.id === "rent"));
});

suite.test("processOffers uses fullPath when standardWebURL missing", () => {
  const offer = makeOffer("plex", "Plex");
  delete offer.standardWebURL;
  const result = processOffers([offer], "https://fallback.com/path");
  assertArrayLength(result, 1);
  assertEqual(result[0].url, "https://fallback.com/path");
});

// --- processOffers with canonicalMap ---

suite.test("processOffers with canonicalMap merges same brand into one", () => {
  const offers = [
    makeOffer("max", "HBO Max"),
    makeOffer("amazonmax", "HBO Max  Amazon Channel"),
  ];
  const canonicalMap = {
    max: { id: "max", name: "HBO Max" },
    amazonmax: { id: "max", name: "HBO Max" },
  };
  const result = processOffers(offers, "https://f.com", canonicalMap);
  assertArrayLength(result, 1);
  assertEqual(result[0].id, "max");
  assertEqual(result[0].name, "HBO Max");
});

suite.test("processOffers with empty map behaves like no map", () => {
  const offers = [
    makeOffer("max", "HBO Max"),
    makeOffer("amazonmax", "HBO Max  Amazon Channel"),
  ];
  const result = processOffers(offers, "https://f.com", {});
  assertArrayLength(result, 2);
});

// --- buildCanonicalProviderMap ---

suite.test("buildCanonicalProviderMap maps same brand to one canonical", () => {
  const packages = [
    { technicalName: "max", clearName: "HBO Max" },
    { technicalName: "amazonmax", clearName: "HBO Max  Amazon Channel" },
  ];
  const map = buildCanonicalProviderMap(packages);
  assertEqual(map.max?.id, "max");
  assertEqual(map.max?.name, "HBO Max");
  assertEqual(map.amazonmax?.id, "max");
  assertEqual(map.amazonmax?.name, "HBO Max");
});

suite.test("buildCanonicalProviderMap handles empty input", () => {
  const map = buildCanonicalProviderMap([]);
  assertEqual(Object.keys(map).length, 0);
});

suite.test("buildCanonicalProviderMaps returns byClearName for data-driven normalization", () => {
  const packages = [
    { technicalName: "max", clearName: "HBO Max" },
    { technicalName: "amazonmax", clearName: "HBO Max  Amazon Channel" },
  ];
  const { byTechnicalName, byClearName } = buildCanonicalProviderMaps(packages);
  assertEqual(byClearName["HBO Max"]?.id, "max");
  assertEqual(byClearName["HBO Max  Amazon Channel"]?.id, "max");
  assertEqual(byClearName["HBO Max  Amazon Channel"]?.name, "HBO Max");
});

// --- tileMatchesProviderFilter (exact match) ---

suite.test("tileMatchesProviderFilter exact match", () => {
  assertEqual(tileMatchesProviderFilter(["HBO Max"], ["HBO Max"]), true);
  assertEqual(tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"]), false);
});

suite.test("tileMatchesProviderFilter returns true when no active filters", () => {
  assertEqual(tileMatchesProviderFilter(["Netflix"], []), true);
});

suite.test("tileMatchesProviderFilter returns false when tile has no providers", () => {
  assertEqual(tileMatchesProviderFilter([], ["Netflix"]), false);
});

// --- providerUtils with window.__CANONICAL_PROVIDERS_BY_NAME__ (data-driven path) ---

suite.test("normalizedProviderKey uses map when window.__CANONICAL_PROVIDERS_BY_NAME__ is set", () => {
  const map = {
    "HBO Max": { id: "max", name: "HBO Max" },
    "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
  };
  const prev = globalThis.window;
  globalThis.window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
  try {
    assertEqual(normalizedProviderKey("HBO Max"), "max");
    assertEqual(normalizedProviderKey("HBO Max  Amazon Channel"), "max");
    assertEqual(normalizedProviderKey("Netflix"), "Netflix");
  } finally {
    globalThis.window = prev;
  }
});

suite.test("deduplicateProviderList collapses by canonical id when map is set", () => {
  const map = {
    "HBO Max": { id: "max", name: "HBO Max" },
    "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
  };
  const prev = globalThis.window;
  globalThis.window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
  try {
    const providers = [
      { id: "max", name: "HBO Max", icon: "https://a" },
      { id: "amazonmax", name: "HBO Max  Amazon Channel", icon: "https://b" },
    ];
    const result = deduplicateProviderList(providers);
    assertArrayLength(result, 1);
    assertEqual(result[0].id, "max");
  } finally {
    globalThis.window = prev;
  }
});

suite.test("tileMatchesProviderFilter matches by canonical id when map is set", () => {
  const map = {
    "HBO Max": { id: "max", name: "HBO Max" },
    "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
  };
  const prev = globalThis.window;
  globalThis.window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
  try {
    assertEqual(tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"]), true);
    assertEqual(tileMatchesProviderFilter(["HBO Max"], ["HBO Max  Amazon Channel"]), true);
  } finally {
    globalThis.window = prev;
  }
});

await suite.run();
