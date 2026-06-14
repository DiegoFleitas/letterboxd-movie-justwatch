// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createProviderFilterSet,
  deduplicateProviderList,
  normalizedProviderKey,
  tileMatchesProviderFilter,
  type ProviderLike,
} from "../utils/providerUtils";

type CanonicalMap = Record<string, { id: string; name: string }>;

function setCanonicalMap(map?: CanonicalMap): void {
  const w = globalThis as { __CANONICAL_PROVIDERS_BY_NAME__?: CanonicalMap } & typeof globalThis;
  if (map) w.__CANONICAL_PROVIDERS_BY_NAME__ = map;
  else delete w.__CANONICAL_PROVIDERS_BY_NAME__;
}

afterEach(() => {
  setCanonicalMap();
});

describe("providerUtils", () => {
  describe("normalizedProviderKey", () => {
    it("returns empty string for nullish/empty inputs", () => {
      setCanonicalMap();
      expect(normalizedProviderKey(undefined)).toBe("");
      expect(normalizedProviderKey(null)).toBe("");
      expect(normalizedProviderKey("")).toBe("");
    });

    it("returns canonical id when canonical map contains the name", () => {
      setCanonicalMap({
        "HBO Max": { id: "max", name: "HBO Max" },
        "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
      });
      expect(normalizedProviderKey("HBO Max")).toBe("max");
      expect(normalizedProviderKey("HBO Max  Amazon Channel")).toBe("max");
      expect(normalizedProviderKey("Netflix")).toBe("Netflix");
    });
  });

  describe("deduplicateProviderList", () => {
    it("returns valid entries unchanged when canonical map is unavailable", () => {
      setCanonicalMap();
      const providers = [
        { id: "max", name: "HBO Max", icon: "https://a" },
        { id: "amazonmax", name: "HBO Max  Amazon Channel", icon: "https://b" },
        { id: "broken", name: "" },
      ] as ProviderLike[];

      const result = deduplicateProviderList(providers);

      expect(result).toEqual([
        { id: "max", name: "HBO Max", icon: "https://a" },
        { id: "amazonmax", name: "HBO Max  Amazon Channel", icon: "https://b" },
      ]);
    });

    it("deduplicates aliases by canonical id and prefers canonical-branded entry", () => {
      setCanonicalMap({
        "HBO Max": { id: "max", name: "HBO Max" },
        "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
      });
      const providers: ProviderLike[] = [
        { id: "amazonmax", name: "HBO Max  Amazon Channel", icon: "https://b" },
        { id: "max", name: "HBO Max", icon: "https://a" },
      ];

      const result = deduplicateProviderList(providers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "max", name: "HBO Max", icon: "https://a" });
    });
  });

  describe("tileMatchesProviderFilter", () => {
    it("uses exact-name matching when canonical map is unavailable", () => {
      setCanonicalMap();
      expect(tileMatchesProviderFilter(["HBO Max"], new Set(["HBO Max"]))).toBe(true);
      expect(tileMatchesProviderFilter(["HBO Max  Amazon Channel"], new Set(["HBO Max"]))).toBe(
        false,
      );
    });

    it("matches aliases and canonical names when canonical map is available", () => {
      setCanonicalMap({
        "HBO Max": { id: "max", name: "HBO Max" },
        "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
      });
      expect(
        tileMatchesProviderFilter(
          ["HBO Max  Amazon Channel"],
          createProviderFilterSet(["HBO Max"]),
        ),
      ).toBe(true);
      expect(
        tileMatchesProviderFilter(
          ["HBO Max"],
          createProviderFilterSet(["HBO Max  Amazon Channel"]),
        ),
      ).toBe(true);
    });

    it("returns true when there are no active filters", () => {
      setCanonicalMap();
      expect(tileMatchesProviderFilter(["Netflix"], null)).toBe(true);
      expect(tileMatchesProviderFilter(["Netflix"], null)).toBe(true);
    });

    it("returns false when filters are active but tile provider names are empty/non-array", () => {
      setCanonicalMap();
      expect(tileMatchesProviderFilter([], new Set(["Netflix"]))).toBe(false);
      expect(
        tileMatchesProviderFilter(undefined as unknown as string[], new Set(["Netflix"])),
      ).toBe(false);
    });
  });

  describe("createProviderFilterSet", () => {
    it("returns null for empty or invalid inputs", () => {
      setCanonicalMap();
      expect(createProviderFilterSet([])).toBeNull();
      expect(createProviderFilterSet(undefined as unknown as string[])).toBeNull();
    });

    it("returns a Set of provider keys when canonical map is unavailable", () => {
      setCanonicalMap();
      const result = createProviderFilterSet(["HBO Max", "Netflix"]);
      expect(result).toEqual(new Set(["HBO Max", "Netflix"]));
    });

    it("returns a Set of canonical IDs when canonical map is available", () => {
      setCanonicalMap({
        "HBO Max": { id: "max", name: "HBO Max" },
        "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
      });
      const result = createProviderFilterSet(["HBO Max", "HBO Max  Amazon Channel", "Netflix"]);
      expect(result).toEqual(new Set(["max", "Netflix"]));
    });
  });
});
