/**
 * Parse Letterboxd list/watchlist page HTML into film entries.
 * Used by the list controller and by unit tests to guard scraping behavior.
 */
import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

/** Selector for "this element is or contains a film link" (data attrs or /film/ link). */
export const SELECTOR_HAS_FILM =
  "[data-target-link], [data-film-slug], [data-item-link], a[href^='/film/']";

/** Ordered list of selectors for film container elements (watchlist vs list pages). */
export const FILM_CONTAINER_SELECTORS = [
  ".griditem",
  "li.posteritem",
  ".listitem, li.poster-container, li.list-item",
  'li[class*="listitem"], li[class*="poster-container"], li[class*="posteritem"]',
  ".really-lazy-load",
];

/** Strings to check in raw HTML for "no content" debug logging. */
export const CONTENT_PRESENCE_MARKERS = [
  "poster-grid",
  "griditem",
  "listitem",
  "posteritem",
] as const;

/**
 * Returns a map of content presence markers for debug logging (e.g. "poster-grid": true).
 */
export function getContentPresence(
  html: string,
): Record<(typeof CONTENT_PRESENCE_MARKERS)[number], boolean> {
  const out = {} as Record<(typeof CONTENT_PRESENCE_MARKERS)[number], boolean>;
  for (const marker of CONTENT_PRESENCE_MARKERS) {
    out[marker] = html.includes(marker);
  }
  return out;
}

export interface PageFilm {
  title: string | null;
  year: string | null;
  link: string;
  poster: string | null;
}

interface FilmData {
  title: string | null;
  year: string | null;
  link: string;
  posterPath: string | null;
  poster: string | null;
}

function normalizePath(path: string | null | undefined): string {
  if (path == null || path === "") return "";
  const p = path.trim();
  return p.startsWith("/") ? p : "/" + p;
}

function getFilmData(film: ReturnType<CheerioAPI>): FilmData {
  const title = film.find("img").first().attr("alt") ?? film.attr("alt") ?? null;
  const linkEl = film.find(SELECTOR_HAS_FILM).first();
  const targetLink =
    film.attr("data-target-link") ??
    linkEl.attr("data-target-link") ??
    film.find("[data-target-link]").first().attr("data-target-link") ??
    film.find("div").attr("data-target-link");
  const itemLink =
    film.attr("data-item-link") ??
    linkEl.attr("data-item-link") ??
    film.find("[data-item-link]").first().attr("data-item-link") ??
    null;
  const titleSlug =
    targetLink ??
    itemLink ??
    film.attr("data-film-slug") ??
    linkEl.attr("data-film-slug") ??
    film.find("[data-film-slug]").first().attr("data-film-slug") ??
    film.find("div").attr("data-film-slug") ??
    null;
  const pathFromHref =
    (linkEl.attr("href") ?? "").trim() ||
    (film.find('a[href^="/film/"]').first().attr("href") ?? "").trim();
  const path =
    normalizePath(targetLink) ||
    normalizePath(itemLink) ||
    normalizePath(titleSlug) ||
    normalizePath(pathFromHref);
  const link = path ? "https://letterboxd.com" + path : "https://letterboxd.com";
  const posterPath = path || null;
  let year: string | null = null;

  const itemName =
    film.attr("data-item-name") ??
    film.find("[data-item-name]").first().attr("data-item-name") ??
    film.find("div").attr("data-item-name");
  if (itemName) {
    const yearMatch = itemName.match(/\((\d{4})\)/);
    if (yearMatch) year = yearMatch[1];
  }
  if (!year && (targetLink ?? path)) {
    const slug = targetLink ?? path;
    const yearMatch = slug.match(/-(\d{4})\/?$/);
    if (yearMatch) year = yearMatch[1];
  }

  return { title, year, link, posterPath, poster: null };
}

/**
 * Extract film entries from a loaded Cheerio document (watchlist or list page).
 */
export function getPageFilms($: CheerioAPI): PageFilm[] {
  let filmContainers = $.root().find(".really-lazy-load");
  for (const sel of FILM_CONTAINER_SELECTORS) {
    const matched = $(sel);
    if (matched.length > 0) {
      filmContainers = matched as typeof filmContainers;
      break;
    }
  }
  const films: PageFilm[] = [];
  filmContainers.each((_i, el) => {
    const film = $(el);
    const value = getFilmData(film);
    films.push({
      title: value.title,
      year: value.year,
      link: value.link,
      poster: value.poster,
    });
  });
  return films.filter(
    (f) => f.link.length > "https://letterboxd.com".length || (f.title ?? "").trim() !== "",
  );
}

/**
 * Parse total film count from visible copy or meta (e.g. "… 20 films", "A list of 104 films").
 * Avoids stripping all digits from titles like "20 años…" which would yield a bogus count.
 */
function parseFilmsCountFromText(text: string): number {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return 0;
  const filmsWord = trimmed.match(/\b(\d{1,6})\s+films?\b/i);
  if (filmsWord) return parseInt(filmsWord[1], 10);
  const listOf = trimmed.match(/\bA list of (\d{1,6}) films\b/i);
  if (listOf) return parseInt(listOf[1], 10);
  return 0;
}

/**
 * Get total film count from section heading and/or meta description.
 */
export function getFilmsCount($: CheerioAPI): number {
  const fromHeading = parseFilmsCountFromText($("h1.section-heading").text());
  if (fromHeading > 0) return fromHeading;

  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  const fromMeta = parseFilmsCountFromText(metaDesc);
  if (fromMeta > 0) return fromMeta;

  const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";
  return parseFilmsCountFromText(ogDesc);
}

/**
 * Parse raw list page HTML into film entries. For use in tests.
 */
export function parseListPageHtml(html: string): PageFilm[] {
  const $ = cheerio.load(html);
  return getPageFilms($);
}

/**
 * Extract the film grid/list HTML from a full Letterboxd page (for fixtures or debugging).
 * Prefers .poster-grid, then ul.grid, then first container that has film links.
 */
export function extractGridHtml(html: string): string {
  const $ = cheerio.load(html);
  const posterGrid = $(".poster-grid").first();
  if (posterGrid.length) {
    return posterGrid.html() ?? "";
  }
  const gridList = $("ul.grid").first();
  if (gridList.length) {
    return gridList.parent().html() ?? gridList.html() ?? "";
  }
  const filmLi = $(`li:has(${SELECTOR_HAS_FILM})`).first();
  if (filmLi.length) {
    const ul = filmLi.closest("ul");
    return ul.length ? (ul.parent().html() ?? ul.html() ?? "") : (filmLi.parent().html() ?? "");
  }
  const filmContainer = $(SELECTOR_HAS_FILM).first().closest("ul, .poster-list, .grid");
  if (filmContainer.length) {
    return filmContainer.parent().html() ?? filmContainer.html() ?? "";
  }
  for (const sel of FILM_CONTAINER_SELECTORS) {
    const listItems = $(sel).first();
    if (listItems.length) {
      const parent = listItems.parent();
      return parent.length ? (parent.html() ?? "") : "";
    }
  }
  return "";
}
