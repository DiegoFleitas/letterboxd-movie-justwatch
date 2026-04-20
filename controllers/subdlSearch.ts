import type { HttpHandler } from "../server/httpContext.js";
import axiosHelper from "../helpers/axios.js";
import { alternativeSearchBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";

const axios = axiosHelper();

interface SubdlSubtitle {
  url?: string;
  download_link?: string;
  subtitle_link?: string;
  subtitlePage?: string;
  sd_id?: number | string;
  subtitle_id?: number | string;
  release_id?: number | string;
}

interface SubdlResponse {
  status?: boolean;
  error?: string;
  subtitles?: SubdlSubtitle[];
}

const subdlEndpoint = "https://api.subdl.com/api/v1/subtitles";

function resolveSubdlUrl(subtitle: SubdlSubtitle): string | null {
  if (subtitle.url) {
    if (/^https?:\/\//i.test(subtitle.url)) return subtitle.url;
    if (subtitle.url.startsWith("/subtitle/")) return `https://dl.subdl.com${subtitle.url}`;
    if (subtitle.url.startsWith("/")) return `https://subdl.com${subtitle.url}`;
  }
  if (subtitle.download_link) {
    if (/^https?:\/\//i.test(subtitle.download_link)) return subtitle.download_link;
    if (subtitle.download_link.startsWith("/subtitle/"))
      return `https://dl.subdl.com${subtitle.download_link}`;
    if (subtitle.download_link.startsWith("/")) return `https://subdl.com${subtitle.download_link}`;
  }
  if (subtitle.subtitle_link) {
    if (/^https?:\/\//i.test(subtitle.subtitle_link)) return subtitle.subtitle_link;
    if (subtitle.subtitle_link.startsWith("/subtitle/"))
      return `https://dl.subdl.com${subtitle.subtitle_link}`;
    if (subtitle.subtitle_link.startsWith("/")) return `https://subdl.com${subtitle.subtitle_link}`;
  }
  if (subtitle.subtitlePage) {
    if (/^https?:\/\//i.test(subtitle.subtitlePage)) return subtitle.subtitlePage;
    if (subtitle.subtitlePage.startsWith("/")) return `https://subdl.com${subtitle.subtitlePage}`;
  }

  const sid = subtitle.sd_id ?? subtitle.subtitle_id;
  const rid = subtitle.release_id;
  if (sid != null && rid != null) {
    return `https://dl.subdl.com/subtitle/${sid}-${rid}.zip`;
  }
  return null;
}

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
    subs_per_page: "1",
  });
  if (year != null && String(year).trim() !== "") {
    params.set("year", String(year));
  }

  try {
    const { data } = await axios.get<SubdlResponse>(`${subdlEndpoint}?${params.toString()}`, {
      timeout: 15000,
    });
    const first = data?.subtitles?.[0];
    const url = first ? resolveSubdlUrl(first) : null;
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
