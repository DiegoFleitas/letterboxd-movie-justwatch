import { describe, expect, it } from "vitest";
import { countries } from "../countries";

describe("countries", () => {
  it("preserves expected ordering and data shape", () => {
    expect(countries.length).toBe(119);
    expect(countries[0]).toEqual({ id: "ca_AD", text: "Andorra" });
    expect(countries.at(-1)).toEqual({ id: "en_ZM", text: "Zambia" });
  });

  it("uses locale_REGION ids so the second segment is the ISO region", () => {
    for (const { id } of countries) {
      expect(id).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });
});
