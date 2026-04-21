export interface SubdlSubtitle {
  url?: string;
  download_link?: string;
  subtitle_link?: string;
  subtitlePage?: string;
  sd_id?: number | string;
  subtitle_id?: number | string;
  release_id?: number | string;
}

export interface SubdlMovieResult {
  name?: string;
  sd_id?: number | string;
}

export interface SubdlResponse {
  status?: boolean;
  error?: string;
  results?: SubdlMovieResult[];
  subtitles?: SubdlSubtitle[];
}

const ZIP_PATH_RE = /\.zip(?:\?|$)/i;
const ALLOWED_SUBDL_HOSTS = new Set(["subdl.com", "www.subdl.com"]);

/** Prefer https://subdl.com pages; never return dl.subdl.com or raw .zip downloads. */
function absoluteBrowseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const parsed = new URL(t);
      const host = parsed.hostname.toLowerCase();
      if (!ALLOWED_SUBDL_HOSTS.has(host)) return null;
      if (ZIP_PATH_RE.test(`${parsed.pathname}${parsed.search}`)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
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
    if (abs) return abs;
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
    .replace(/[\u0027\u2018\u2019\u02BC]/g, "");
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

export function pickSubdlBrowseUrl(data: SubdlResponse | undefined): string | null {
  if (!data) return null;
  return pickFirstSubtitleBrowseUrl(data.subtitles) ?? filmSubtitleBrowseUrl(data.results?.[0]);
}
