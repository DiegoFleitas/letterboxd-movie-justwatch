const axios = require("../helpers/axios")(true); // Set keepAlive to true
const cheerio = require("cheerio");
const { getCacheValue, setCacheValue } = require("../helpers/redis");
const cacheTtl = process.env.CACHE_TTL || 1; // minutes

const POSTER_WIDTH = 230;
const POSTER_HEIGHT = 345;

const getPosterUrl = (id, titleSlug, cacheBustingKey) => {
  return `https://a.ltrbxd.com/resized/film-poster/${id
    ?.split("")
    ?.join(
      "/"
    )}/${id}-${titleSlug}-0-${POSTER_WIDTH}-0-${POSTER_HEIGHT}-crop.jpg?k=${cacheBustingKey}`;
};

const getFilmData = async (film) => {
  const cacheBustingKey = film.find("div")?.attr("data-cache-busting-key");
  const title = film.find("img")?.attr("alt");
  let titleSlug =
    film.find("div")?.attr("data-target-link") ||
    film.find("div")?.attr("data-film-slug");
  let id = film.find("div")?.attr("data-film-id");
  let year = film.find("div")?.attr("data-film-slug")?.match(/\d{4}/)?.[0];
  const link =
    "https://letterboxd.com" + film.find("div")?.attr("data-target-link");

  let poster;
  if (cacheBustingKey) {
    const url = `https://letterboxd.com/ajax/poster${titleSlug}std/125x187/?k=${cacheBustingKey}`;
    const ajaxResponse = await axios.get(url);
    const $$ = cheerio.load(ajaxResponse.data);
    let filmAux = $$(".film-poster");

    id = filmAux?.attr("data-film-id");
    year = filmAux?.attr("data-film-release-year");
    titleSlug = filmAux?.attr("data-film-link");
    poster = filmAux
      .find("img")
      ?.attr("src")
      ?.replace("125-0-187", `${POSTER_WIDTH}-0-${POSTER_HEIGHT}`);
  }

  return { title, year, link, poster, id, titleSlug };
};

const getPageFilms = async (url) => {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const filmPromises = $(".poster-container")
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
      if (!poster) {
        poster = getPosterUrl(id, titleSlug, cacheBustingKey);
      }

      return {
        title,
        year,
        link,
        poster,
      };
    });
};

const letterboxdWatchlist = async (req, res) => {
  try {
    let { username } = req.body;
    if (!username)
      return res.status(400).json({ error: "Watchlist file not found" });

    const cacheKey = `watchlist:${username}`;
    const cachedWatchlist = await getCacheValue(cacheKey);
    if (cachedWatchlist) {
      console.log("Watchlist found (cached)");
      return res.status(200).json({
        message: "Watchlist found",
        watchlist: cachedWatchlist,
      });
    }

    const proxy = "";
    const baseUrl = `${proxy}https://letterboxd.com/${username}/watchlist/by/popular`;
    let currentPage = 1;
    let films = [];

    const maxPages = 80;
    while (currentPage <= maxPages) {
      const url = `${baseUrl}/page/${currentPage}/`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const pageFilms = await getPageFilms(url);
      if (pageFilms.length === 0) {
        // No films on this page, we're done scraping
        break;
      }
      films = films.concat(pageFilms);
      currentPage++;
    }
    const filmsArray = await Promise.all(films);
    await setCacheValue(cacheKey, filmsArray, cacheTtl);
    res.status(200).json({
      message: "Watchlist found",
      watchlist: filmsArray,
    });
  } catch (error) {
    console.log(error);
    if (error?.response?.status === 404) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }
    if (error?.response?.status === 401) {
      res.status(404).json({ error: "Watchlist is not public" });
      return;
    }
    // console.log(response.data);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { letterboxdWatchlist };
