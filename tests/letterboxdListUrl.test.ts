/**
 * Unit tests for Letterboxd list URL parsing (watchlist and custom list).
 */
import { describe, it, expect } from "vitest";
import { parseLetterboxdListUrl, isLetterboxdListUrlInput } from "@server/lib/letterboxdListUrl.js";

describe("Letterboxd list URL parsing", () => {
  it.each([
    {
      name: "valid watchlist URL with trailing slash",
      input: "https://letterboxd.com/user/watchlist/",
      expected: {
        username: "user",
        listType: "watchlist",
        listUrl: "https://letterboxd.com/user/watchlist/",
      },
    },
    {
      name: "valid watchlist URL without trailing slash gets normalized",
      input: "https://letterboxd.com/user/watchlist",
      expected: {
        username: "user",
        listType: "watchlist",
        listUrl: "https://letterboxd.com/user/watchlist/",
      },
    },
    {
      name: "valid custom list URL",
      input: "https://letterboxd.com/user/list/my-list/",
      expected: {
        username: "user",
        listType: "custom list",
        listUrl: "https://letterboxd.com/user/list/my-list/",
      },
    },
    {
      name: "custom list URL without trailing slash gets normalized",
      input: "https://letterboxd.com/user/list/my-list",
      expected: {
        username: "user",
        listType: "custom list",
        listUrl: "https://letterboxd.com/user/list/my-list/",
      },
    },
    {
      name: "URL with /page/2 is stripped to base list URL",
      input: "https://letterboxd.com/user/watchlist/page/2/",
      expected: {
        username: "user",
        listType: "watchlist",
        listUrl: "https://letterboxd.com/user/watchlist/",
      },
    },
    {
      name: "www.letterboxd.com is accepted",
      input: "https://www.letterboxd.com/shoemonger/watchlist/",
      expected: {
        username: "shoemonger",
        listType: "watchlist",
        listUrl: "https://www.letterboxd.com/shoemonger/watchlist/",
      },
    },
  ])("$name", ({ input, expected }) => {
    const result = parseLetterboxdListUrl(input);
    expect(result).toMatchObject(expected);
  });

  it.each([
    "https://example.com/user/watchlist/",
    "",
    "   ",
    "https://letterboxd.com/",
    "https://letterboxd.com/user/list/",
    "ftp://letterboxd.com/user/watchlist/",
  ])("invalid URL returns null: %s", (input) => {
    expect(parseLetterboxdListUrl(input)).toBeFalsy();
  });

  it("input with leading/trailing whitespace is trimmed before parse", () => {
    const result = parseLetterboxdListUrl("  https://letterboxd.com/user/watchlist/  ");
    expect(result).toBeTruthy();
    expect(result!.username).toBe("user");
  });

  it.each([
    "https://letterboxd.com/user/watchlist/",
    "http://letterboxd.com/user/watchlist/",
    "www.letterboxd.com/user/watchlist/",
  ])("isLetterboxdListUrlInput returns true: %s", (input) => {
    expect(isLetterboxdListUrlInput(input)).toBe(true);
  });

  it.each(["Title,Year\nFoo,2020", ""])("isLetterboxdListUrlInput returns false: %s", (input) => {
    expect(isLetterboxdListUrlInput(input)).toBe(false);
  });
});
