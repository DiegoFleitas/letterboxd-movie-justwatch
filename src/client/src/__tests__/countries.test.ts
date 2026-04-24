import { describe, expect, it } from "vitest";
import { countries } from "../countries";

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
});
