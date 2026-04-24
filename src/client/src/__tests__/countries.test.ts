import { describe, expect, it } from "vitest";
import { countries, flagFromCountryCode } from "../countries";

describe("flagFromCountryCode", () => {
  it("maps ISO 3166-1 alpha-2 codes to regional indicator flags", () => {
    expect(flagFromCountryCode("US")).toBe("🇺🇸");
    expect(flagFromCountryCode("de")).toBe("🇩🇪");
    expect(flagFromCountryCode("Gb")).toBe("🇬🇧");
  });

  it("trims whitespace before normalizing", () => {
    expect(flagFromCountryCode("  jp  ")).toBe("🇯🇵");
  });

  it("returns the white flag emoji when the code is not two letters A–Z", () => {
    expect(flagFromCountryCode("")).toBe("🏳️");
    expect(flagFromCountryCode("   ")).toBe("🏳️");
    expect(flagFromCountryCode("U")).toBe("🏳️");
    expect(flagFromCountryCode("USA")).toBe("🏳️");
    expect(flagFromCountryCode("U1")).toBe("🏳️");
    expect(flagFromCountryCode("1U")).toBe("🏳️");
  });
});

describe("countries", () => {
  it("preserves expected ordering and data shape", () => {
    expect(countries.length).toBe(119);
    expect(countries[0]).toEqual({ id: "ca_AD", text: "Andorra", flag: "🇦🇩" });
    expect(countries.at(-1)).toEqual({ id: "en_ZM", text: "Zambia", flag: "🇿🇲" });
  });

  it("derives flags from country code in id", () => {
    expect(countries.find((country) => country.id === "en_US")?.flag).toBe("🇺🇸");
    expect(countries.find((country) => country.id === "es_AR")?.flag).toBe("🇦🇷");
    expect(countries.find((country) => country.id === "sq_XK")?.flag).toBe("🇽🇰");
  });

  it("uses locale_REGION ids so the second segment is the ISO region used for flags", () => {
    for (const { id } of countries) {
      expect(id).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      const region = id.split("_")[1];
      expect(flagFromCountryCode(region)).toBe(countries.find((c) => c.id === id)?.flag);
    }
  });
});
