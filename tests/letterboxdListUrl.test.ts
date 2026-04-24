/**
 * Unit tests for Letterboxd list URL parsing (watchlist and custom list).
 */
import { describe, it, expect } from "vitest";
import { parseLetterboxdListUrl, isLetterboxdListUrlInput } from "@server/lib/letterboxdListUrl.js";

const LB_HTTPS = "https://letterboxd.com";
const USER = "user";
const USER_WATCHLIST = `${LB_HTTPS}/${USER}/watchlist`;
const USER_WATCHLIST_SLASH = `${USER_WATCHLIST}/`;
const USER_CUSTOM_LIST = `${LB_HTTPS}/${USER}/list/my-list`;
const USER_CUSTOM_LIST_SLASH = `${USER_CUSTOM_LIST}/`;

function expectParsedList(
  username: string,
  listType: "watchlist" | "custom list",
  listUrl: string,
) {
  return { username, listType, listUrl };
}

describe("Letterboxd list URL parsing", () => {
  it.each([
    {
      name: "valid watchlist URL with trailing slash",
      input: USER_WATCHLIST_SLASH,
      expected: expectParsedList(USER, "watchlist", USER_WATCHLIST_SLASH),
    },
    {
      name: "valid watchlist URL without trailing slash gets normalized",
      input: USER_WATCHLIST,
      expected: expectParsedList(USER, "watchlist", USER_WATCHLIST_SLASH),
    },
    {
      name: "valid custom list URL",
      input: USER_CUSTOM_LIST_SLASH,
      expected: expectParsedList(USER, "custom list", USER_CUSTOM_LIST_SLASH),
    },
    {
      name: "custom list URL without trailing slash gets normalized",
      input: USER_CUSTOM_LIST,
      expected: expectParsedList(USER, "custom list", USER_CUSTOM_LIST_SLASH),
    },
    {
      name: "URL with /page/2 is stripped to base list URL",
      input: `${USER_WATCHLIST}/page/2/`,
      expected: expectParsedList(USER, "watchlist", USER_WATCHLIST_SLASH),
    },
    {
      name: "www.letterboxd.com is accepted",
      input: "https://www.letterboxd.com/shoemonger/watchlist/",
      expected: expectParsedList(
        "shoemonger",
        "watchlist",
        "https://www.letterboxd.com/shoemonger/watchlist/",
      ),
    },
    {
      name: "input with leading/trailing whitespace is trimmed before parse",
      input: `  ${USER_WATCHLIST_SLASH}  `,
      expected: expectParsedList(USER, "watchlist", USER_WATCHLIST_SLASH),
    },
  ])("$name", ({ input, expected }) => {
    expect(parseLetterboxdListUrl(input)).toMatchObject(expected);
  });

  it.each([
    "https://example.com/user/watchlist/",
    "",
    "   ",
    "https://letterboxd.com/",
    `${LB_HTTPS}/user/list/`,
    "ftp://letterboxd.com/user/watchlist/",
  ])("invalid URL returns null: %s", (input) => {
    expect(parseLetterboxdListUrl(input)).toBeFalsy();
  });

  it.each([
    USER_WATCHLIST_SLASH,
    `http://letterboxd.com/${USER}/watchlist/`,
    `www.letterboxd.com/${USER}/watchlist/`,
  ])("isLetterboxdListUrlInput returns true: %s", (input) => {
    expect(isLetterboxdListUrlInput(input)).toBe(true);
  });

  it.each(["Title,Year\nFoo,2020", ""])("isLetterboxdListUrlInput returns false: %s", (input) => {
    expect(isLetterboxdListUrlInput(input)).toBe(false);
  });
});
