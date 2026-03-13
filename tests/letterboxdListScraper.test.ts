/**
 * Unit tests for Letterboxd list page HTML parsing (watchlist and list).
 * Guards scraping behavior so changes (e.g. ESI retry, selectors) don't break working paths.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as cheerio from "cheerio";
import {
  parseListPageHtml,
  extractGridHtml,
  getContentPresence,
  getFilmsCount,
} from "../helpers/letterboxdListHtml.js";
import { TestSuite, assertEqual, assertTruthy, assertArrayLength } from "./testUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

const suite = new TestSuite("Letterboxd list page scraper");

suite.test("parses watchlist-style HTML with .griditem and data-target-link", () => {
  const html = readFileSync(join(fixturesDir, "letterboxd-watchlist-page.html"), "utf-8");
  const films = parseListPageHtml(html);
  assertTruthy(films.length >= 2, "expect at least 2 films from watchlist fixture");
  const ghostStory = films.find((f) => f.link.includes("a-ghost-story-2017"));
  assertTruthy(ghostStory != null, "find A Ghost Story");
  assertEqual(ghostStory!.title, "A Ghost Story");
  assertEqual(ghostStory!.year, "2017");
  assertEqual(ghostStory!.link, "https://letterboxd.com/film/a-ghost-story-2017/");
});

suite.test("returns empty array for HTML with no film containers", () => {
  const films = parseListPageHtml("<html><body><p>No films here</p></body></html>");
  assertArrayLength(films, 0);
});

suite.test("extracts title from img alt and year from data-item-name", () => {
  const html = `
    <ul class="grid">
      <li class="griditem">
        <div data-target-link="/film/lake-mungo/" data-item-name="Lake Mungo (2008)">
          <img alt="Lake Mungo" />
        </div>
      </li>
    </ul>
  `;
  const films = parseListPageHtml(html);
  assertArrayLength(films, 1);
  assertEqual(films[0].title, "Lake Mungo");
  assertEqual(films[0].year, "2008");
  assertEqual(films[0].link, "https://letterboxd.com/film/lake-mungo/");
});

suite.test("extracts year from target-link slug when data-item-name missing", () => {
  const html = `
    <li class="griditem">
      <div data-target-link="/film/some-movie-2023/">
        <img alt="Some Movie" />
      </div>
    </li>
  `;
  const films = parseListPageHtml(html);
  assertArrayLength(films, 1);
  assertEqual(films[0].year, "2023");
});

suite.test("parses list-fragment HTML with li.posteritem and data-target-link", () => {
  const html = readFileSync(join(fixturesDir, "letterboxd-list-fragment.html"), "utf-8");
  const films = parseListPageHtml(html);
  assertTruthy(films.length >= 1, "expect at least 1 film from list fragment fixture");
  assertEqual(films[0].title, "Act of Violence Upon a Young Journalist");
  assertEqual(films[0].year, "1988");
  assertEqual(
    films[0].link,
    "https://letterboxd.com/film/act-of-violence-upon-a-young-journalist/",
  );
});

suite.test("extractGridHtml returns .poster-grid content when present", () => {
  const html = `<div class="other"><div class="poster-grid"><ul><li class="griditem">x</li></ul></div></div>`;
  const out = extractGridHtml(html);
  assertTruthy(out.includes("griditem"), "extracted HTML contains griditem");
  assertTruthy(out.includes("<li"), "extracted HTML contains list item");
});

suite.test("extractGridHtml returns ul.grid when no .poster-grid", () => {
  const html = `<body><ul class="grid"><li class="griditem">a</li></ul></body>`;
  const out = extractGridHtml(html);
  assertTruthy(out.includes("griditem") || out.includes("grid"), "extracted grid or parent");
});

suite.test(
  "extractGridHtml returns first li:has(film link) container when no .poster-grid or ul.grid",
  () => {
    const html = `<div><ul class="poster-list"><li class="posteritem"><div data-target-link="/film/foo/"><img alt="Foo"/></div></li></ul></div>`;
    const out = extractGridHtml(html);
    assertTruthy(
      out.includes("posteritem") || out.includes("data-target-link"),
      "extracted film list",
    );
  },
);

suite.test("extractGridHtml returns empty string when no film grid present", () => {
  const html = `<html><body><p>No films</p></body></html>`;
  assertEqual(extractGridHtml(html), "");
});

suite.test("getContentPresence returns all false for empty HTML", () => {
  const out = getContentPresence("");
  assertEqual(out["poster-grid"], false);
  assertEqual(out["griditem"], false);
  assertEqual(out["listitem"], false);
  assertEqual(out["posteritem"], false);
});

suite.test("getContentPresence returns true for markers present in HTML", () => {
  const html = `<div class="poster-grid"><li class="griditem">x</li><li class="posteritem">y</li></div>`;
  const out = getContentPresence(html);
  assertEqual(out["poster-grid"], true);
  assertEqual(out["griditem"], true);
  assertEqual(out["listitem"], false);
  assertEqual(out["posteritem"], true);
});

suite.test("getFilmsCount parses number from section heading", () => {
  const html = `<h1 class="section-heading">shoemonger wants to see 20 films</h1>`;
  const $ = cheerio.load(html);
  assertEqual(getFilmsCount($), 20);
});

suite.test("getFilmsCount returns 0 when no section heading", () => {
  const html = `<html><body><h1>Other</h1></body></html>`;
  const $ = cheerio.load(html);
  assertEqual(getFilmsCount($), 0);
});

suite.test("getFilmsCount returns 0 when heading has no digits", () => {
  const html = `<h1 class="section-heading">No number here</h1>`;
  const $ = cheerio.load(html);
  assertEqual(getFilmsCount($), 0);
});

suite.run().then(({ failed }) => {
  process.exit(failed > 0 ? 1 : 0);
});
