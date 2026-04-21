import type { HttpHandler } from "../server/httpContext.js";
import axiosHelper from "../helpers/axios.js";
import { alternativeSearchBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";
import { pickSubdlBrowseUrl, type SubdlResponse } from "../lib/subdlBrowseUrl.js";

const axios = axiosHelper();

const subdlEndpoint = "https://api.subdl.com/api/v1/subtitles";

export const subdlSearch: HttpHandler = async ({ req, res }) => {
  const parsedBody = alternativeSearchBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }

  const subdlApiKey = process.env.SUBDL_API_KEY;
  if (!subdlApiKey?.trim()) {
    res.status(503).json({ error: "Subtitles search is not configured" });
    return;
  }

  const { title, year } = parsedBody.data;
  const params = new URLSearchParams({
    api_key: subdlApiKey,
    film_name: title,
    type: "movie",
    languages: (process.env.SUBDL_LANGUAGES || "EN").trim(),
    subs_per_page: "25",
  });
  if (year != null && String(year).trim() !== "") {
    params.set("year", String(year));
  }

  try {
    const { data } = await axios.get<SubdlResponse>(`${subdlEndpoint}?${params.toString()}`, {
      timeout: 15000,
    });
    const url = pickSubdlBrowseUrl(data);
    if (!data?.status || !url) {
      res.status(404).json({ error: data?.error || "No subtitles found." });
      return;
    }
    res.status(200).json({ url, title, year });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
