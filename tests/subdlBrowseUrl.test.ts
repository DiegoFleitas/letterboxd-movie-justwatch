import { describe, it, expect } from "vitest";
import { pickSubdlBrowseUrl, type SubdlResponse } from "../lib/subdlBrowseUrl.js";

describe("pickSubdlBrowseUrl", () => {
  it("prefers subtitlePage as relative path on subdl.com", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [{ subtitlePage: "/s/info/AbCdEf" }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/s/info/AbCdEf");
  });

  it("skips dl.subdl.com and zip paths, then uses a later subtitle row with a page", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [
        { url: "/subtitle/1-2.zip", download_link: "https://dl.subdl.com/subtitle/1-2.zip" },
        { subtitlePage: "/s/info/xyz" },
      ],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/s/info/xyz");
  });

  it("accepts absolute https://subdl.com browse URL from subtitle_link", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [{ subtitle_link: "https://subdl.com/subtitle/sd99/foo" }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd99/foo");
  });

  it("accepts absolute https://www.subdl.com browse URL", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [{ subtitle_link: "https://www.subdl.com/subtitle/sd99/foo" }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://www.subdl.com/subtitle/sd99/foo");
  });

  it("rejects attacker-controlled hostnames that contain subdl.com as a substring", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [{ subtitle_link: "https://subdl.com.evil.com/subtitle/sd99/foo" }],
      results: [{ name: "Die Hard", sd_id: 12345 }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd12345/die-hard");
  });

  it("falls back to film page from results when subtitles have no browse URL", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [{ url: "/subtitle/9-8.zip" }],
      results: [{ name: "Die Hard", sd_id: 12345 }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd12345/die-hard");
  });

  it("slugifies film name with ampersand and accents", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [],
      results: [{ name: "Fish & Chips: L'Été", sd_id: 1 }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd1/fish-and-chips-lete");
  });

  it("strips both straight and curly apostrophes in slugs", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [],
      results: [{ name: "Schindler’s List", sd_id: 7 }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd7/schindlers-list");
  });

  it("strips left single quotation marks in slugs", () => {
    const data: SubdlResponse = {
      status: true,
      subtitles: [],
      results: [{ name: "L‘Avventura", sd_id: 9 }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd9/lavventura");
  });

  it("normalizes sd_id string with sd prefix", () => {
    const data: SubdlResponse = {
      status: true,
      results: [{ name: "x", sd_id: "sd42" }],
    };
    expect(pickSubdlBrowseUrl(data)).toBe("https://subdl.com/subtitle/sd42/x");
  });

  it("returns null when nothing usable is present", () => {
    expect(pickSubdlBrowseUrl(undefined)).toBeNull();
    expect(pickSubdlBrowseUrl({ status: true, subtitles: [{}] })).toBeNull();
    expect(pickSubdlBrowseUrl({ status: true, results: [{ name: "", sd_id: 1 }] })).toBeNull();
  });
});
