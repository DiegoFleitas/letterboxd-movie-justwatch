import type { HttpHandler } from "../httpContext.js";
import { captureServerException } from "../lib/sentryCapture.js";
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

const cacheTtl = Number(process.env.CACHE_TTL) || 300;

interface FetchListArgs {
  url: string;
  cacheKeyPrefix: string;
  req: { body: unknown };
  res: {
    status: (code: number) => { json: (payload: unknown) => void };
    json: (payload: unknown) => void;
  };
}

async function fetchFromCache(
  cacheKey: string,
  cacheCategories: string[],
): Promise<PageFilm[] | null> {
  const cachedList = (await getCacheValue(cacheKey)) as PageFilm[] | null | undefined;
  if (cachedList && Array.isArray(cachedList)) {
    await indexCacheKeyByCategory(cacheKey, cacheCategories);
    return cachedList;
  }
  return null;
}

function getCacheCategories(cacheKeyPrefix: string): string[] {
  return cacheKeyPrefix.startsWith("watchlist:") ? ["list", "watchlist"] : ["list"];
}

async function tryEsiFallback(
  pageUrl: string,
  listHeaders: Record<string, string>,
  cheerioInstance: cheerio.CheerioAPI,
): Promise<{ $: cheerio.CheerioAPI; pageFilms: PageFilm[]; html: string }> {
  const esiUrl = pageUrl + (pageUrl.includes("?") ? "&" : "?") + "esiAllowFilters=true";
  try {
    const esiHtml = await fetchLetterboxdHtml(esiUrl, listHeaders);
    const $esi = cheerio.load(esiHtml);
    const esiFilms = getPageFilms($esi);
    return { $: $esi, pageFilms: esiFilms, html: esiHtml };
  } catch (esiErr) {
    console.warn("ESI retry failed for", esiUrl, (esiErr as Error).message);
    return { $: cheerioInstance, pageFilms: [], html: "" };
  }
}

function logEmptyPage(pageUrl: string, baseUrl: string, lastHtml: string): void {
  if (baseUrl.includes("/list/")) {
    const presence = getContentPresence(lastHtml);
    const parts = Object.entries(presence)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    console.log(`Page ${pageUrl} has no content (${parts}), stopping pagination.`);
  } else {
    console.log(`Page ${pageUrl} has no content, stopping pagination.`);
  }
}

async function cacheEmptyPage(cacheKey: string, cacheCategories: string[]): Promise<void> {
  await setCacheValue(cacheKey, [], cacheTtl, cacheCategories);
}

function logSkipCache(cacheKey: string, page: number): void {
  console.log(
    `[LIST_CACHE_SKIP] No parsable films for starting page ${page} (${cacheKey}); not caching. Often markup changed, blocked HTML, or an empty watchlist.`,
  );
}

async function handlePageFilms(
  $: cheerio.CheerioAPI,
  filmsCount: number,
  totalPages: number,
  filmsPerPage: number,
): Promise<{ filmsCount: number; totalPages: number; haveFilmTotal: boolean }> {
  const parsedCount = getFilmsCount($);
  if (parsedCount > 0) {
    const newTotalPages = Math.ceil(parsedCount / filmsPerPage) || 1;
    return {
      filmsCount: parsedCount,
      totalPages: newTotalPages,
      haveFilmTotal: true,
    };
  }
  return { filmsCount, totalPages, haveFilmTotal: false };
}

const fetchList = async ({ url, cacheKeyPrefix, req, res }: FetchListArgs): Promise<void> => {
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
    let haveFilmTotal = false;
    let filmsPromises: PageFilm[] = [];
    let lastPage: number | null = null;
    const cacheCategories = getCacheCategories(cacheKeyPrefix);

    for (let index = 0; index < maxPages; index++) {
      currentPage = Number(page) + index;
      const cacheKey = `${cacheKeyPrefix}:page:${currentPage}`;
      const cachedFilms = await fetchFromCache(cacheKey, cacheCategories);
      if (cachedFilms) {
        console.log(`List for page ${currentPage} found (cached)`);
        filmsPromises = filmsPromises.concat(cachedFilms);
        continue;
      }

      const pageUrl = `${baseUrl}/page/${currentPage}/`;
      const listHeaders = buildLetterboxdHtmlRequestHeaders(getRandomScrapeUserAgent());
      const html = await fetchLetterboxdHtml(pageUrl, listHeaders);
      let $ = cheerio.load(html);
      let pageFilms = getPageFilms($);
      let lastHtml: string = html;

      if (pageFilms.length === 0 && baseUrl.includes("/list/")) {
        const esiResult = await tryEsiFallback(pageUrl, listHeaders, $);
        $ = esiResult.$;
        pageFilms = esiResult.pageFilms;
        if (esiResult.html) lastHtml = esiResult.html;
      }

      if (pageFilms.length === 0) {
        logEmptyPage(pageUrl, baseUrl, lastHtml);
        if (haveFilmTotal) {
          await cacheEmptyPage(cacheKey, cacheCategories);
        } else if (currentPage === page) {
          logSkipCache(cacheKey, page);
        }
        break;
      }

      if (!haveFilmTotal) {
        const result = await handlePageFilms($, filmsCount, totalPages, filmsPerPage);
        filmsCount = result.filmsCount;
        totalPages = result.totalPages;
        haveFilmTotal = result.haveFilmTotal;
        if (haveFilmTotal && currentPage > totalPages) {
          res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Invalid list page" });
          return;
        }
      }

      await setCacheValue(cacheKey, pageFilms, cacheTtl, cacheCategories);
      filmsPromises = filmsPromises.concat(pageFilms);
    }

    const films = filmsPromises;
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
    captureServerException(error, { route: "letterboxd-list-fetch" });
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
