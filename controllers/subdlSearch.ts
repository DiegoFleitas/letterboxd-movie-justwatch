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

interface SubdlMovieResult {
  name?: string;
  sd_id?: number | string;
}

interface SubdlResponse {
  status?: boolean;
  error?: string;
  results?: SubdlMovieResult[];
  subtitles?: SubdlSubtitle[];
}

const subdlEndpoint = "https://api.subdl.com/api/v1/subtitles";

const ZIP_PATH_RE = /\.zip(?:\?|$)/i;

function isDlHost(url: string): boolean {
  return /dl\.subdl\.com/i.test(url);
}

/** Prefer https://subdl.com pages; never return dl.subdl.com or raw .zip downloads. */
function absoluteBrowseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    if (isDlHost(t) || ZIP_PATH_RE.test(t)) return null;
    return t;
  }
  if (t.startsWith("/")) {
    if (ZIP_PATH_RE.test(t)) return null;
    return `https://subdl.com${t}`;
  }
  return null;
}

function subtitleBrowseUrlFromFields(s: SubdlSubtitle): string | null {
  const ordered = [s.subtitlePage, s.subtitle_link, s.url, s.download_link];
  for (const raw of ordered) {
    if (typeof raw !== "string") continue;
    const abs = absoluteBrowseUrl(raw);
    if (abs && /subdl\.com/i.test(abs) && !isDlHost(abs)) return abs;
  }
  return null;
}

function pickFirstSubtitleBrowseUrl(subtitles: SubdlSubtitle[] | undefined): string | null {
  if (!subtitles?.length) return null;
  for (const s of subtitles) {
    const u = subtitleBrowseUrlFromFields(s);
    if (u) return u;
  }
  return null;
}

function slugifySubdlTitle(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['']/g, "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "movie";
}

function filmSubtitleBrowseUrl(film: SubdlMovieResult | undefined): string | null {
  const name = film?.name?.trim();
  if (!name || film?.sd_id == null) return null;
  const id = String(film.sd_id).replace(/^sd/i, "");
  if (!/^\d+$/.test(id)) return null;
  const slug = slugifySubdlTitle(name);
  return `https://subdl.com/subtitle/sd${id}/${slug}`;
}

function pickBrowseUrl(data: SubdlResponse | undefined): string | null {
  if (!data) return null;
  return pickFirstSubtitleBrowseUrl(data.subtitles) ?? filmSubtitleBrowseUrl(data.results?.[0]);
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
    subs_per_page: "25",
  });
  if (year != null && String(year).trim() !== "") {
    params.set("year", String(year));
  }

  try {
    const { data } = await axios.get<SubdlResponse>(`${subdlEndpoint}?${params.toString()}`, {
      timeout: 15000,
    });
    const url = pickBrowseUrl(data);
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
