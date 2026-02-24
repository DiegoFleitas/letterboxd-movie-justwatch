import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper(true); // Set keepAlive to true
import * as cheerio from "cheerio";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const cacheTtl = process.env.CACHE_TTL || 20; // minutes
const postersTtl = process.env.CACHE_TTL || 60; // minutes

const POSTER_WIDTH = 230;
const POSTER_HEIGHT = 345;

// Note: Letterboxd poster CDN URLs are blocked by Cloudflare
// We'll return null and let the frontend fetch posters from OMDB instead


// OLD:
// Example of the HTML structure
// film.html()
// ' <div class="really-lazy-load poster film-poster film-poster-576577 linked-film-poster" data-image-width="125" data-image-height="187" data-type="film" data-type-name="film" data-film-id="576577" data-item-uid="film:576577" data-film-slug="the-grave-of-st-oran" data-poster-url="/film/the-grave-of-st-oran/image-150/" data-linked="linked" data-target-link="/film/the-grave-of-st-oran/" data-target-link-target="" data-details-endpoint="/film/the-grave-of-st-oran/json/" data-cache-busting-key="_ac8883a1" data-show-menu="true"> <img src="https://s.ltrbxd.com/static/img/empty-poster-125-AiuBHVCI.png" class="image" width="125" height="187" alt="The Grave of St. Oran"> <span class="frame"><span class="frame-title"></span></span> </div> '
// GET https://letterboxd.com/film/the-grave-of-st-oran/json/
// {"result":true,"csrf":"d02b27d3078c84a80fb7","id":576577,"uid":"film:576577","name":"The Grave of St. Oran","type":"film","image125":"/film/the-grave-of-st-oran/image-125/","image150":"/film/the-grave-of-st-oran/image-150/","releaseYear":2019,"runTime":9,"slug":"the-grave-of-st-oran","url":"/film/the-grave-of-st-oran/","originalName":null,"filmlistAction":"/ajax/film:576577/filmlistentry","watchlistAction":"/film/the-grave-of-st-oran/add-to-watchlist/","directors":[{"name":"Jim Batt"}]}


// NEW:
// Example of the HTML structure
// film.html()
// <div class="react-component" data-component-class="LazyPoster" data-request-poster-metadata="true" data-likeable="true" data-watchable="true" data-rateable="true" data-image-width="125" data-image-height="187" data-item-name="The Little Drummer Girl (2018)" data-item-slug="the-little-drummer-girl-2018" data-item-link="/film/the-little-drummer-girl-2018/" data-item-full-display-name="The Little Drummer Girl (2018)" data-film-id="484585" data-postered-identifier="{&quot;lid&quot;:&quot;kkCS&quot;,&quot;uid&quot;:&quot;film:484585&quot;,&quot;type&quot;:&quot;film&quot;,&quot;typeName&quot;:&quot;film&quot;}" data-poster-url="/film/the-little-drummer-girl-2018/image-150/" data-resolvable-poster-path="{&quot;postered&quot;:{&quot;lid&quot;:&quot;kkCS&quot;,&quot;uid&quot;:&quot;film:484585&quot;,&quot;type&quot;:&quot;film&quot;,&quot;typeName&quot;:&quot;film&quot;},&quot;posteredBaseLink&quot;:&quot;/film/the-little-drummer-girl-2018/&quot;,&quot;isAdultThemed&quot;:false,&quot;hasDefaultPoster&quot;:true,&quot;cacheBustingKey&quot;:&quot;9aa648f4&quot;}" data-empty-poster-src="https://s.ltrbxd.com/static/img/empty-poster-125-AiuBHVCI.png" data-is-linked="true" data-target-link="/film/the-little-drummer-girl-2018/" data-details-endpoint="/film/the-little-drummer-girl-2018/json/" data-show-menu="true"> <div class="poster film-poster"> <img src="https://s.ltrbxd.com/static/img/empty-poster-125-AiuBHVCI.png" class="image" width="125" height="187" alt="The Little Drummer Girl"> <span class="frame"><span class="frame-title"></span></span> </div> </div>

const getFilmData = async (film) => {
  const title = film.find("img")?.attr("alt");
  const targetLink = film.find("div")?.attr("data-target-link");
  let titleSlug = targetLink || film.find("div")?.attr("data-film-slug");
  let id = film.find("div")?.attr("data-film-id");
  const link = "https://letterboxd.com" + targetLink;
  const posterPath = targetLink; // Keep the path for poster API

  // Extract year from multiple sources
  let year = null;
  
  // Try data-item-name first (e.g., "The Little Drummer Girl (2018)")
  const itemName = film.find("div")?.attr("data-item-name");
  if (itemName) {
    const yearMatch = itemName.match(/\((\d{4})\)/);
    if (yearMatch) {
      year = yearMatch[1];
    }
  }
  
  // Fallback: try target link slug (e.g., "/film/the-little-drummer-girl-2018/")
  if (!year && targetLink) {
    const yearMatch = targetLink.match(/-(\d{4})\/?$/);
    if (yearMatch) {
      year = yearMatch[1];
    }
  }

  // Don't fetch poster server-side - Letterboxd blocks server requests
  // The frontend will fetch poster URLs directly since browsers can access them
  let poster = null;

  return { title, year, link, posterPath, poster, id, titleSlug };
};

const getFilmsCount = ($) => {
  const rawFilmsText = $("h1.section-heading").text();
  return parseInt(rawFilmsText.replace(/[^0-9]/g, ""));
};

const getPageFilms = async ($) => {
  const filmPromises = $(".griditem")
    .map(async (i, el) => {
      const film = $(el);
      return getFilmData(film);
    })
    .get();

  // prevent losing the entire watchlist if a single film fails to load
  const films = await Promise.allSettled(filmPromises);

  return films
    .filter(({ status }) => status === "fulfilled")
    .map(({ value: { title, year, link, poster, id, titleSlug } }) => {
      return {
        title,
        year,
        link,
        poster,
      };
    });
};

const fetchList = async (url, cacheKeyPrefix, req, res) => {
  try {
    const { page = 1 } = { ...req.body };
    if (page < 1) return res.status(400).json({ error: "Invalid page number" });

    const maxPages = 20;
    const filmsPerPage = 28; // letterboxd default
    let totalPages = 1;
    let currentPage = 0;
    let filmsCount = 0;
    let filmsPromises = [];
    let lastPage = null;

    for (let index = 0; index < maxPages; index++) {
      currentPage = parseInt(page) + index;
      const cacheKey = `${cacheKeyPrefix}:page:${currentPage}`;
      const cachedList = await getCacheValue(cacheKey);

      if (cachedList) {
        console.log(`List for page ${currentPage} found (cached)`);
        filmsPromises = filmsPromises.concat(cachedList);
      } else {
        const response = await axios.get(`${url}/page/${currentPage}/`);
        const $ = cheerio.load(response.data);
        
        // Check if page has any films (list items in the grid)
        const hasFilms = $(".poster-grid ul.grid li").length > 0;
        if (!hasFilms) {
          console.log(`Page ${url}/page/${currentPage}/ has no content, stopping pagination.`);
          break;
        }
        
        if (!filmsCount) {
          filmsCount = getFilmsCount($);
          totalPages = Math.ceil(filmsCount / filmsPerPage);
          if (currentPage > totalPages) {
            return res.status(404).json({ error: "Invalid list page" });
          }
        }
        const pageFilmsPromise = await getPageFilms($);

        if (pageFilmsPromise.length === 0) {
          break;
        }
        Promise.all(pageFilmsPromise).then((pageFilms) => {
          setCacheValue(cacheKey, pageFilms, cacheTtl, "list");
        });
        filmsPromises = filmsPromises.concat(pageFilmsPromise);
      }
    }

    const films = await Promise.all(filmsPromises);
    res.status(200).json({
      message: "List found",
      watchlist: films,
      lastPage: Math.min(currentPage, totalPages),
      totalPages: totalPages || lastPage,
    });
  } catch (error) {
    console.error(error);
    if (error?.response?.status === 404) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const letterboxdWatchlist = async (req, res) => {
  const { username, listUrl, listType } = { ...req.body };
  if (!username) return res.status(400).json({ error: "Watchlist file not found" });

  // const url = `https://letterboxd.com/${username}/watchlist/by/popular`;
  const cacheKeyPrefix = `watchlist:${username}_${listType}`;
  await fetchList(listUrl, cacheKeyPrefix, req, res);
};

export const letterboxdCustomList = async (req, res) => {
  const { username, listUrl, listType } = { ...req.body };
  if (!listUrl) return res.status(400).json({ error: "Custom list URL not found" });

  const cacheKeyPrefix = `customlist:${username}_${listType}`;
  await fetchList(listUrl, cacheKeyPrefix, req, res);
};