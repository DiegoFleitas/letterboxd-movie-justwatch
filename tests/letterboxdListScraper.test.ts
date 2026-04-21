/**
 * Unit tests for Letterboxd list page HTML parsing (watchlist and list).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as cheerio from "cheerio";
import { describe, it, expect } from "vitest";
import {
  parseListPageHtml,
  extractGridHtml,
  getContentPresence,
  getFilmsCount,
} from "@server/lib/letterboxdListHtml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("Letterboxd list page scraper", () => {
  it("parses watchlist-style HTML with .griditem and data-target-link", () => {
    const html = readFileSync(join(fixturesDir, "letterboxd-watchlist-page.html"), "utf-8");
    const films = parseListPageHtml(html);
    expect(films.length).toBeGreaterThanOrEqual(2);
    const ghostStory = films.find((f) => f.link.includes("a-ghost-story-2017"));
    expect(ghostStory).toBeDefined();
    expect(ghostStory!.title).toBe("A Ghost Story");
    expect(ghostStory!.year).toBe("2017");
    expect(ghostStory!.link).toBe("https://letterboxd.com/film/a-ghost-story-2017/");
  });

  it("returns empty array for HTML with no film containers", () => {
    const films = parseListPageHtml("<html><body><p>No films here</p></body></html>");
    expect(films).toHaveLength(0);
  });

  it("extracts title from img alt and year from data-item-name", () => {
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
    expect(films).toHaveLength(1);
    expect(films[0].title).toBe("Lake Mungo");
    expect(films[0].year).toBe("2008");
    expect(films[0].link).toBe("https://letterboxd.com/film/lake-mungo/");
  });

  it("extracts year from target-link slug when data-item-name missing", () => {
    const html = `
    <li class="griditem">
      <div data-target-link="/film/some-movie-2023/">
        <img alt="Some Movie" />
      </div>
    </li>
  `;
    const films = parseListPageHtml(html);
    expect(films).toHaveLength(1);
    expect(films[0].year).toBe("2023");
  });

  it("parses list-fragment HTML with li.posteritem and data-target-link", () => {
    const html = readFileSync(join(fixturesDir, "letterboxd-list-fragment.html"), "utf-8");
    const films = parseListPageHtml(html);
    expect(films.length).toBeGreaterThanOrEqual(1);
    expect(films[0].title).toBe("Act of Violence Upon a Young Journalist");
    expect(films[0].year).toBe("1988");
    expect(films[0].link).toBe(
      "https://letterboxd.com/film/act-of-violence-upon-a-young-journalist/",
    );
  });

  it("extractGridHtml returns .poster-grid content when present", () => {
    const html = `<div class="other"><div class="poster-grid"><ul><li class="griditem">x</li></ul></div></div>`;
    const out = extractGridHtml(html);
    expect(out).toContain("griditem");
    expect(out).toContain("<li");
  });

  it("extractGridHtml returns ul.grid when no .poster-grid", () => {
    const html = `<body><ul class="grid"><li class="griditem">a</li></ul></body>`;
    const out = extractGridHtml(html);
    expect(out.includes("griditem") || out.includes("grid")).toBe(true);
  });

  it("extractGridHtml returns first li:has(film link) container when no .poster-grid or ul.grid", () => {
    const html = `<div><ul class="poster-list"><li class="posteritem"><div data-target-link="/film/foo/"><img alt="Foo"/></div></li></ul></div>`;
    const out = extractGridHtml(html);
    expect(out.includes("posteritem") || out.includes("data-target-link")).toBe(true);
  });

  it("extractGridHtml returns empty string when no film grid present", () => {
    const html = `<html><body><p>No films</p></body></html>`;
    expect(extractGridHtml(html)).toBe("");
  });

  it("getContentPresence returns all false for empty HTML", () => {
    const out = getContentPresence("");
    expect(out["poster-grid"]).toBe(false);
    expect(out["griditem"]).toBe(false);
    expect(out["listitem"]).toBe(false);
    expect(out["posteritem"]).toBe(false);
  });

  it("getContentPresence returns true for markers present in HTML", () => {
    const html = `<div class="poster-grid"><li class="griditem">x</li><li class="posteritem">y</li></div>`;
    const out = getContentPresence(html);
    expect(out["poster-grid"]).toBe(true);
    expect(out["griditem"]).toBe(true);
    expect(out["listitem"]).toBe(false);
    expect(out["posteritem"]).toBe(true);
  });

  it("getFilmsCount parses number from section heading", () => {
    const html = `<h1 class="section-heading">shoemonger wants to see 20 films</h1>`;
    const $ = cheerio.load(html);
    expect(getFilmsCount($)).toBe(20);
  });

  it("getFilmsCount returns 0 when no section heading", () => {
    const html = `<html><body><h1>Other</h1></body></html>`;
    const $ = cheerio.load(html);
    expect(getFilmsCount($)).toBe(0);
  });

  it("getFilmsCount returns 0 when heading has no digits", () => {
    const html = `<h1 class="section-heading">No number here</h1>`;
    const $ = cheerio.load(html);
    expect(getFilmsCount($)).toBe(0);
  });

  it("getFilmsCount does not treat year digits in a title as film count", () => {
    const html = `<h1 class="section-heading">En cartel: 20 años de cine uruguayo en afiches</h1>`;
    const $ = cheerio.load(html);
    expect(getFilmsCount($)).toBe(0);
  });

  it("getFilmsCount reads total from meta description when section heading has no count", () => {
    const html = `
      <head>
        <meta name="description" content="A list of 104 films compiled on Letterboxd, including Foo (1994)." />
      </head>
      <body><h1 class="title-1 prettify">En cartel: 20 años de cine uruguayo en afiches</h1></body>`;
    const $ = cheerio.load(html);
    expect(getFilmsCount($)).toBe(104);
  });
});
