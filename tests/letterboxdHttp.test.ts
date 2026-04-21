import { describe, it, expect } from "vitest";
import {
  LetterboxdHttpError,
  buildLetterboxdHtmlRequestHeaders,
  buildLetterboxdImageRequestHeaders,
} from "@server/lib/letterboxdHttp.js";

describe("LetterboxdHttpError", () => {
  it("exposes HTTP status", () => {
    const e = new LetterboxdHttpError("not found", 404);
    expect(e.status).toBe(404);
    expect(e.name).toBe("LetterboxdHttpError");
  });
});

describe("Letterboxd request headers", () => {
  it("buildLetterboxdHtmlRequestHeaders sets Accept for HTML", () => {
    const h = buildLetterboxdHtmlRequestHeaders("TestUA/1.0");
    expect(h["User-Agent"]).toBe("TestUA/1.0");
    expect(h.Accept).toContain("text/html");
    expect(h.Referer).toBe("https://letterboxd.com/");
  });

  it("buildLetterboxdImageRequestHeaders sets Accept for images", () => {
    const h = buildLetterboxdImageRequestHeaders("TestUA/1.0");
    expect(h["User-Agent"]).toBe("TestUA/1.0");
    expect(h.Accept).toContain("image/");
    expect(h.Referer).toBe("https://letterboxd.com/");
  });
});
