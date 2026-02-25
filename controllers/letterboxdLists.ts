import type { Request, Response } from "express";
import type { CheerioAPI } from "cheerio";
import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper(true);
import * as cheerio from "cheerio";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const cacheTtl = Number(process.env.CACHE_TTL) || 20;

interface FilmData {
  title: string | null;
  year: string | null;
  link: string;
  posterPath: string | null;
  poster: string | null;
  id?: string | null;
  titleSlug?: string | null;
}

interface PageFilm {
  title: string | null;
  year: string | null;
  link: string;
  poster: string | null;
}

const getFilmData = async (film: ReturnType<CheerioAPI>): Promise<FilmData> => {
  const title = film.find("img")?.attr("alt") ?? null;
  const targetLink = film.find("div")?.attr("data-target-link");
  const titleSlug = (targetLink || film.find("div")?.attr("data-film-slug")) ?? null;
  const id = film.find("div")?.attr("data-film-id") ?? null;
  const link = "https://letterboxd.com" + (targetLink ?? "");
  const posterPath = targetLink ?? null;
  let year: string | null = null;

  const itemName = film.find("div")?.attr("data-item-name");
  if (itemName) {
    const yearMatch = itemName.match(/\((\d{4})\)/);
    if (yearMatch) year = yearMatch[1];
  }
  if (!year && targetLink) {
    const yearMatch = targetLink.match(/-(\d{4})\/?$/);
    if (yearMatch) year = yearMatch[1];
  }

  return { title, year, link, posterPath, poster: null, id, titleSlug };
};

const getFilmsCount = ($: CheerioAPI): number => {
  const rawFilmsText = $("h1.section-heading").text();
  return parseInt(rawFilmsText.replace(/[^0-9]/g, ""), 10) || 0;
};

const getPageFilms = async ($: CheerioAPI): Promise<PageFilm[]> => {
  const filmPromises = $(".griditem")
    .map(async (_i, el) => {
      const film = $(el);
      return getFilmData(film);
    })
    .get();

  const films = await Promise.allSettled(filmPromises);
  return films
    .filter((r): r is PromiseFulfilledResult<FilmData> => r.status === "fulfilled")
    .map(({ value }) => ({
      title: value.title,
      year: value.year,
      link: value.link,
      poster: value.poster,
    }));
};

const fetchList = async (
  url: string,
  cacheKeyPrefix: string,
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = (req.body as { page?: number }) ?? {};
    const page = body.page ?? 1;
    if (page < 1) {
      res.status(400).json({ error: "Invalid page number" });
      return;
    }

    const maxPages = 20;
    const filmsPerPage = 28;
    let totalPages = 1;
    let currentPage = 0;
    let filmsCount = 0;
    let filmsPromises: PageFilm[] = [];
    let lastPage: number | null = null;

    for (let index = 0; index < maxPages; index++) {
      currentPage = Number(page) + index;
      const cacheKey = `${cacheKeyPrefix}:page:${currentPage}`;
      const cachedList = await getCacheValue(cacheKey) as PageFilm[] | null | undefined;

      if (cachedList && Array.isArray(cachedList)) {
        console.log(`List for page ${currentPage} found (cached)`);
        filmsPromises = filmsPromises.concat(cachedList);
      } else {
        const response = await axios.get(`${url}/page/${currentPage}/`);
        const $ = cheerio.load(response.data);

        const hasFilms = $(".poster-grid ul.grid li").length > 0;
        if (!hasFilms) {
          console.log(`Page ${url}/page/${currentPage}/ has no content, stopping pagination.`);
          break;
        }

        if (!filmsCount) {
          filmsCount = getFilmsCount($);
          totalPages = Math.ceil(filmsCount / filmsPerPage);
          if (currentPage > totalPages) {
            res.status(404).json({ error: "Invalid list page" });
            return;
          }
        }
        const pageFilmsPromise = await getPageFilms($);

        if (pageFilmsPromise.length === 0) break;

        setCacheValue(cacheKey, pageFilmsPromise, cacheTtl, "list");
        filmsPromises = filmsPromises.concat(pageFilmsPromise);
      }
    }

    const films = await Promise.all(filmsPromises);
    res.status(200).json({
      message: "List found",
      watchlist: films,
      lastPage: Math.min(currentPage, totalPages),
      totalPages: totalPages || (lastPage ?? 1),
    });
  } catch (error) {
    console.error(error);
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 404) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const letterboxdWatchlist = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body as { username?: string; listUrl?: string; listType?: string }) ?? {};
  const { username, listUrl, listType } = body;
  if (!username) {
    res.status(400).json({ error: "Watchlist file not found" });
    return;
  }
  const cacheKeyPrefix = `watchlist:${username}_${listType ?? ""}`;
  await fetchList(listUrl ?? "", cacheKeyPrefix, req, res);
};

export const letterboxdCustomList = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body as { username?: string; listUrl?: string; listType?: string }) ?? {};
  const { username, listUrl, listType } = body;
  if (!listUrl) {
    res.status(400).json({ error: "Custom list URL not found" });
    return;
  }
  const cacheKeyPrefix = `customlist:${username ?? ""}_${listType ?? ""}`;
  await fetchList(listUrl, cacheKeyPrefix, req, res);
};
