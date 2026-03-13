/**
 * Unit tests for Letterboxd list URL parsing (watchlist and custom list).
 */
import { parseLetterboxdListUrl, isLetterboxdListUrlInput } from "../lib/letterboxdListUrl.js";
import { TestSuite, assertEqual, assertTruthy, assertFalsy } from "./testUtils.js";

const suite = new TestSuite("Letterboxd list URL parsing");

suite.test("valid watchlist URL with trailing slash", () => {
  const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist/");
  assertTruthy(result);
  assertEqual(result!.username, "user");
  assertEqual(result!.listType, "watchlist");
  assertEqual(result!.listUrl, "https://letterboxd.com/user/watchlist/");
});

suite.test("valid watchlist URL without trailing slash gets normalized", () => {
  const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist");
  assertTruthy(result);
  assertEqual(result!.username, "user");
  assertEqual(result!.listType, "watchlist");
  assertEqual(result!.listUrl, "https://letterboxd.com/user/watchlist/");
});

suite.test("valid custom list URL", () => {
  const result = parseLetterboxdListUrl("https://letterboxd.com/user/list/my-list/");
  assertTruthy(result);
  assertEqual(result!.username, "user");
  assertEqual(result!.listType, "custom list");
  assertEqual(result!.listUrl, "https://letterboxd.com/user/list/my-list/");
});

suite.test("custom list URL without trailing slash gets normalized", () => {
  const result = parseLetterboxdListUrl("https://letterboxd.com/user/list/my-list");
  assertTruthy(result);
  assertEqual(result!.listUrl, "https://letterboxd.com/user/list/my-list/");
});

suite.test("URL with /page/2 is stripped to base list URL", () => {
  const result = parseLetterboxdListUrl("https://letterboxd.com/user/watchlist/page/2/");
  assertTruthy(result);
  assertEqual(result!.listUrl, "https://letterboxd.com/user/watchlist/");
});

suite.test("www.letterboxd.com is accepted", () => {
  const result = parseLetterboxdListUrl("https://www.letterboxd.com/shoemonger/watchlist/");
  assertTruthy(result);
  assertEqual(result!.username, "shoemonger");
  assertEqual(result!.listType, "watchlist");
  assertEqual(result!.listUrl, "https://www.letterboxd.com/shoemonger/watchlist/");
});

suite.test("invalid: wrong domain returns null", () => {
  assertFalsy(parseLetterboxdListUrl("https://example.com/user/watchlist/"));
});

suite.test("invalid: empty string returns null", () => {
  assertFalsy(parseLetterboxdListUrl(""));
});

suite.test("invalid: only whitespace returns null", () => {
  assertFalsy(parseLetterboxdListUrl("   "));
});

suite.test("invalid: missing path returns null", () => {
  assertFalsy(parseLetterboxdListUrl("https://letterboxd.com/"));
});

suite.test("invalid: list in path but invalid shape returns null", () => {
  assertFalsy(parseLetterboxdListUrl("https://letterboxd.com/user/list/"));
});

suite.test("invalid: non-http URL returns null", () => {
  assertFalsy(parseLetterboxdListUrl("ftp://letterboxd.com/user/watchlist/"));
});

suite.test("input with leading/trailing whitespace is trimmed before parse", () => {
  const result = parseLetterboxdListUrl("  https://letterboxd.com/user/watchlist/  ");
  assertTruthy(result);
  assertEqual(result!.username, "user");
});

suite.test("isLetterboxdListUrlInput: true for https", () => {
  assertTruthy(isLetterboxdListUrlInput("https://letterboxd.com/user/watchlist/"));
});

suite.test("isLetterboxdListUrlInput: true for http", () => {
  assertTruthy(isLetterboxdListUrlInput("http://letterboxd.com/user/watchlist/"));
});

suite.test("isLetterboxdListUrlInput: true for www", () => {
  assertTruthy(isLetterboxdListUrlInput("www.letterboxd.com/user/watchlist/"));
});

suite.test("isLetterboxdListUrlInput: false for CSV-like content", () => {
  assertFalsy(isLetterboxdListUrlInput("Title,Year\nFoo,2020"));
});

suite.test("isLetterboxdListUrlInput: false for empty", () => {
  assertFalsy(isLetterboxdListUrlInput(""));
});

suite.run().then(({ failed }) => {
  process.exit(failed > 0 ? 1 : 0);
});
