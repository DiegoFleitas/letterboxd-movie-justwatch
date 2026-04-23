import type { HttpHandler } from "../httpContext.js";
import axiosHelper from "../lib/axios.js";
import { alternativeSearchBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";
import { pickSubdlBrowseUrl, type SubdlResponse } from "../lib/subdlBrowseUrl.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
} from "../httpStatusCodes.js";

const axios = axiosHelper();

const subdlEndpoint = "https://api.subdl.com/api/v1/subtitles";

export const subdlSearch: HttpHandler = async ({ req, res }) => {
  const parsedBody = alternativeSearchBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }

  const subdlApiKey = process.env.SUBDL_API_KEY;
  if (!subdlApiKey?.trim()) {
    res
      .status(HTTP_STATUS_SERVICE_UNAVAILABLE)
      .json({ error: "Subtitles search is not configured" });
    return;
  }

  const { title, year } = parsedBody.data;
  const params: Record<string, string> = {
    api_key: subdlApiKey,
    film_name: title,
    type: "movie",
    languages: (process.env.SUBDL_LANGUAGES || "EN").trim(),
    subs_per_page: "25",
  };
  if (year != null && String(year).trim() !== "") {
    params.year = String(year);
  }

  try {
    const { data } = await axios.get<SubdlResponse>(subdlEndpoint, {
      params,
      timeout: 15000,
    });
    const url = pickSubdlBrowseUrl(data);
    if (!data?.status || !url) {
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: data?.error || "No subtitles found." });
      return;
    }
    res.status(HTTP_STATUS_OK).json({ url, title, year });
  } catch (error) {
    const axiosError = error as {
      message?: string;
      code?: string;
      response?: { status?: number; statusText?: string };
    };
    console.error("[subdlSearch] Request failed", {
      message: axiosError?.message || "Unknown error",
      code: axiosError?.code,
      status: axiosError?.response?.status,
      statusText: axiosError?.response?.statusText,
    });
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};
