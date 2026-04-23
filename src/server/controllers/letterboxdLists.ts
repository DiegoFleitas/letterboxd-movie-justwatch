import type { HttpHandler } from "../httpContext.js";
import * as Sentry from "@sentry/node";
import * as cheerio from "cheerio";
import { getCacheValue, indexCacheKeyByCategory, setCacheValue } from "../lib/redis.js";
import {
  getPageFilms,
  getFilmsCount,
  getContentPresence,
  type PageFilm,
} from "../lib/letterboxdListHtml.js";
import {
  letterboxdWatchlistBodySchema,
  letterboxdCustomListBodySchema,
  firstZodIssueMessage,
} from "../lib/apiSchemas.js";
import {
  LetterboxdHttpError,
  buildLetterboxdHtmlRequestHeaders,
  fetchLetterboxdHtml,
} from "../lib/letterboxdHttp.js";
import { getRandomScrapeUserAgent } from "../lib/scrapeUserAgent.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "../httpStatusCodes.js";

const cacheTtl = Number(process.env.CACHE_TTL) || 20;

const fetchList = async ({
  url,
  cacheKeyPrefix,
  req,
  res,
}: {
  url: string;
  cacheKeyPrefix: string;
  req: { body: unknown };
  res: {
    status: (code: number) => { json: (payload: unknown) => void };
    json: (payload: unknown) => void;
  };
}): Promise<void> => {
  try {
    const baseUrl = url.replace(/\/+$/, "");
    const body = (req.body as { page?: number }) ?? {};
    const page = body.page ?? 1;
    if (page < 1) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({ error: "Invalid page number" });
      return;
    }

    const maxPages = 20;
    const filmsPerPage = 28;
    let totalPages = 1;
    let currentPage = 0;
    let filmsCount = 0;
    /** When true, {@link filmsCount} / {@link totalPages} came from the page (not default). */
    let haveFilmTotal = false;
    let filmsPromises: PageFilm[] = [];
    let lastPage: number | null = null;
    const cacheCategories: string[] = cacheKeyPrefix.startsWith("watchlist:")
      ? ["list", "watchlist"]
      : ["list"];

    for (let index = 0; index < maxPages; index++) {
      currentPage = Number(page) + index;
      const cacheKey = `${cacheKeyPrefix}:page:${currentPage}`;
      const cachedList = (await getCacheValue(cacheKey)) as PageFilm[] | null | undefined;

      if (cachedList && Array.isArray(cachedList)) {
        console.log(`List for page ${currentPage} found (cached)`);
        await indexCacheKeyByCategory(cacheKey, cacheCategories);
        filmsPromises = filmsPromises.concat(cachedList);
      } else {
        const pageUrl = `${baseUrl}/page/${currentPage}/`;
        const listHeaders = buildLetterboxdHtmlRequestHeaders(getRandomScrapeUserAgent());
        const html = await fetchLetterboxdHtml(pageUrl, listHeaders);
        let $ = cheerio.load(html);
        let pageFilmsPromise = getPageFilms($);
        let lastHtml: string = html;
        if (pageFilmsPromise.length === 0 && baseUrl.includes("/list/")) {
          const esiUrl = pageUrl + (pageUrl.includes("?") ? "&" : "?") + "esiAllowFilters=true";
          try {
            const esiHtml = await fetchLetterboxdHtml(esiUrl, listHeaders);
            $ = cheerio.load(esiHtml);
            pageFilmsPromise = getPageFilms($);
            lastHtml = esiHtml;
          } catch (esiErr) {
            console.warn("ESI retry failed for", esiUrl, (esiErr as Error).message);
          }
        }
        if (pageFilmsPromise.length === 0) {
          if (baseUrl.includes("/list/")) {
            const presence = getContentPresence(lastHtml);
            const parts = Object.entries(presence)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            console.log(`Page ${pageUrl} has no content (${parts}), stopping pagination.`);
          } else {
            console.log(`Page ${pageUrl} has no content, stopping pagination.`);
          }
          break;
        }

        if (!haveFilmTotal) {
          const parsedCount = getFilmsCount($);
          if (parsedCount > 0) {
            filmsCount = parsedCount;
            totalPages = Math.ceil(filmsCount / filmsPerPage) || 1;
            haveFilmTotal = true;
            if (currentPage > totalPages) {
              res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Invalid list page" });
              return;
            }
          }
        }

        await setCacheValue(cacheKey, pageFilmsPromise, cacheTtl, cacheCategories);
        filmsPromises = filmsPromises.concat(pageFilmsPromise);
      }
    }

    const films = await Promise.all(filmsPromises);
    res.status(HTTP_STATUS_OK).json({
      message: "List found",
      watchlist: films,
      lastPage: Math.min(currentPage, totalPages),
      totalPages: totalPages || (lastPage ?? 1),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof LetterboxdHttpError && error.status === HTTP_STATUS_NOT_FOUND) {
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: "List not found" });
      return;
    }
    if (Sentry.getClient()) {
      Sentry.captureException(error, { extra: { route: "letterboxd-list-fetch" } });
    }
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

export const letterboxdWatchlist: HttpHandler = async ({ req, res }) => {
  const parsedBody = letterboxdWatchlistBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { username, listType, parsedListUrl, page } = parsedBody.data;
  const cacheKeyPrefix = `watchlist:${username}_${listType ?? ""}`;
  await fetchList({ url: parsedListUrl, cacheKeyPrefix, req: { body: { page } }, res });
};

export const letterboxdCustomList: HttpHandler = async ({ req, res }) => {
  const parsedBody = letterboxdCustomListBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { username, listType, parsedListUrl, page } = parsedBody.data;
  const cacheKeyPrefix = `customlist:${username}_${listType ?? ""}`;
  await fetchList({ url: parsedListUrl, cacheKeyPrefix, req: { body: { page } }, res });
};
