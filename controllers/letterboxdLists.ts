import type { HttpHandler } from "../server/httpContext.js";
import * as Sentry from "@sentry/node";
import * as cheerio from "cheerio";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";
import { parseLetterboxdCsv } from "../helpers/letterboxdCsv.js";
import {
  getPageFilms,
  getFilmsCount,
  getContentPresence,
  type PageFilm,
} from "../helpers/letterboxdListHtml.js";
import {
  letterboxdWatchlistBodySchema,
  letterboxdCustomListBodySchema,
  letterboxdCsvBodySchema,
  firstZodIssueMessage,
} from "../lib/apiSchemas.js";
import {
  LetterboxdHttpError,
  buildLetterboxdHtmlRequestHeaders,
  fetchLetterboxdHtml,
} from "../lib/letterboxdHttp.js";
import { getRandomScrapeUserAgent } from "../lib/scrapeUserAgent.js";

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
      const cachedList = (await getCacheValue(cacheKey)) as PageFilm[] | null | undefined;

      if (cachedList && Array.isArray(cachedList)) {
        console.log(`List for page ${currentPage} found (cached)`);
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

        if (!filmsCount) {
          filmsCount = getFilmsCount($);
          totalPages = Math.ceil(filmsCount / filmsPerPage) || 1;
          if (currentPage > totalPages) {
            res.status(404).json({ error: "Invalid list page" });
            return;
          }
        }

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
    if (error instanceof LetterboxdHttpError && error.status === 404) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    if (Sentry.getClient()) {
      Sentry.captureException(error, { extra: { route: "letterboxd-list-fetch" } });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const letterboxdWatchlist: HttpHandler = async ({ req, res }) => {
  const parsedBody = letterboxdWatchlistBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { username, listType, parsedListUrl, page } = parsedBody.data;
  const cacheKeyPrefix = `watchlist:${username}_${listType ?? ""}`;
  await fetchList({ url: parsedListUrl, cacheKeyPrefix, req: { body: { page } }, res });
};

export const letterboxdCustomList: HttpHandler = async ({ req, res }) => {
  const parsedBody = letterboxdCustomListBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { username, listType, parsedListUrl, page } = parsedBody.data;
  const cacheKeyPrefix = `customlist:${username}_${listType ?? ""}`;
  await fetchList({ url: parsedListUrl, cacheKeyPrefix, req: { body: { page } }, res });
};

export const letterboxdListFromCsv: HttpHandler = async ({ req, res }) => {
  const parsedBody = letterboxdCsvBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { csv } = parsedBody.data;
  try {
    const rows = parseLetterboxdCsv(csv);
    const watchlist = rows.map((row) => ({
      title: row.title,
      year: row.year,
      link: row.link || "",
      posterPath: null as string | null,
      poster: null as string | null,
    }));
    res.status(200).json({
      message: "List found",
      watchlist,
      lastPage: 1,
      totalPages: 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid CSV";
    res.status(400).json({ error: message });
  }
};
