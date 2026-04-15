/**
 * Unit tests for Letterboxd list URL parsing (watchlist and custom list).
 */
import { describe, it, expect } from "vitest";
import { parseLetterboxdListUrl, isLetterboxdListUrlInput } from "../lib/letterboxdListUrl.js";

describe("Letterboxd list URL parsing", () => {
  it("valid watchlist URL with trailing slash", () => {
    const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist/");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("user");
    expect(result!.listType).toBe("watchlist");
    expect(result!.listUrl).toBe("https://letterboxd.com/user/watchlist/");
  });

  it("valid watchlist URL without trailing slash gets normalized", () => {
    const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("user");
    expect(result!.listType).toBe("watchlist");
    expect(result!.listUrl).toBe("https://letterboxd.com/user/watchlist/");
  });

  it("valid custom list URL", () => {
    const result = parseLetterboxdListUrl("https://letterboxd.com/user/list/my-list/");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("user");
    expect(result!.listType).toBe("custom list");
    expect(result!.listUrl).toBe("https://letterboxd.com/user/list/my-list/");
  });

  it("custom list URL without trailing slash gets normalized", () => {
    const result = parseLetterboxdListUrl("https://letterboxd.com/user/list/my-list");
    expect(result).toBeTruthy();
    expect(result!.listUrl).toBe("https://letterboxd.com/user/list/my-list/");
  });

  it("URL with /page/2 is stripped to base list URL", () => {
    const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist/page/2/");
    expect(result).toBeTruthy();
    expect(result!.listUrl).toBe("https://letterboxd.com/user/watchlist/");
  });

  it("www.letterboxd.com is accepted", () => {
    const result = parseLetterboxdListUrl("https://www.letterboxd.com/shoemonger/watchlist/");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("shoemonger");
    expect(result!.listType).toBe("watchlist");
    expect(result!.listUrl).toBe("https://www.letterboxd.com/shoemonger/watchlist/");
  });

  it("invalid: wrong domain returns null", () => {
    expect(parseLetterboxdListUrl("https://example.com/user/watchlist/")).toBeFalsy();
  });

  it("invalid: empty string returns null", () => {
    expect(parseLetterboxdListUrl("")).toBeFalsy();
  });

  it("invalid: only whitespace returns null", () => {
    expect(parseLetterboxdListUrl("   ")).toBeFalsy();
  });

  it("invalid: missing path returns null", () => {
    expect(parseLetterboxdListUrl("https://letterboxd.com/")).toBeFalsy();
  });

  it("invalid: list in path but invalid shape returns null", () => {
    expect(parseLetterboxdListUrl("https://letterboxd.com/user/list/")).toBeFalsy();
  });

  it("invalid: non-http URL returns null", () => {
    expect(parseLetterboxdListUrl("ftp://letterboxd.com/user/watchlist/")).toBeFalsy();
  });

  it("input with leading/trailing whitespace is trimmed before parse", () => {
    const result = parseLetterboxdListUrl("  https://letterboxd.com/user/watchlist/  ");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("user");
  });

  it("isLetterboxdListUrlInput: true for https", () => {
    expect(isLetterboxdListUrlInput("https://letterboxd.com/user/watchlist/")).toBe(true);
  });

  it("isLetterboxdListUrlInput: true for http", () => {
    expect(isLetterboxdListUrlInput("http://letterboxd.com/user/watchlist/")).toBe(true);
  });

  it("isLetterboxdListUrlInput: true for www", () => {
    expect(isLetterboxdListUrlInput("www.letterboxd.com/user/watchlist/")).toBe(true);
  });

  it("isLetterboxdListUrlInput: false for non-URL text input", () => {
    expect(isLetterboxdListUrlInput("Title,Year\nFoo,2020")).toBe(false);
  });

  it("isLetterboxdListUrlInput: false for empty", () => {
    expect(isLetterboxdListUrlInput("")).toBe(false);
  });
});
