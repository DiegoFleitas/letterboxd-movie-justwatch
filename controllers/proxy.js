import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper();
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const cacheTtl = process.env.CACHE_TTL || 60; // minutes

export const proxy = async (req, res) => {
  const url = req.originalUrl.replace("/api/proxy/", "");
  const { method } = req;
  try {
    if (!url) {
      console.log("No url");
      return res.status(404).json({ message: "Url not found" });
    }
    let response;

    const cacheKey = `proxy:${method}:${url}:${JSON.stringify(req.body)}`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      console.log("Response found (cached)");
      return res.status(200).json(cachedResponse);
    }

    switch (method) {
      case "GET":
        response = await axios.get(addApiKeyToUrl(url));
        break;
      case "POST":
        response = await axios.post(addApiKeyToUrl(url));
        break;
    }
    await setCacheValue(cacheKey, response?.data, cacheTtl);
    return res.status(response.status).json(response?.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// this way we avoid leaking secrets to client side
const addApiKeyToUrl = (url) => {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  switch (domain) {
    case "www.omdbapi.com":
      urlObj.searchParams.append("apikey", process.env.OMDB_API_KEY);
      break;
    case "api.themoviedb.org":
      urlObj.searchParams.append("api_key", process.env.MOVIE_DB_API_KEY);
      break;
    default:
      break;
  }
  const result = urlObj.toString();
  console.log(result);
  return result;
};
