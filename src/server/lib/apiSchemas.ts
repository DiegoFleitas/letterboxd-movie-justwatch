import { z } from "zod";
import { parseLetterboxdListUrl } from "./letterboxdListUrl.js";
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FORBIDDEN } from "../httpStatusCodes.js";

/** Hostnames clients may request through `/api/proxy/*` (HTTPS only). */
export const PROXY_ALLOWED_HOSTNAMES = new Set(["api.themoviedb.org", "www.omdbapi.com"]);

const proxyValidationMessages = {
  missing: "Missing proxy target URL",
  invalid: "Invalid proxy target URL",
  https: "Only HTTPS proxy targets are allowed",
  host: "Proxy target host is not allowed",
} as const;

const proxyHttpsOrHostMessages = new Set<string>([
  proxyValidationMessages.https,
  proxyValidationMessages.host,
]);

const proxyPathUrlSchema = z
  .string()
  .trim()
  .min(1, proxyValidationMessages.missing)
  .superRefine((s, ctx) => {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: proxyValidationMessages.invalid,
      });
      return;
    }
    if (u.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: proxyValidationMessages.https,
      });
      return;
    }
    if (!PROXY_ALLOWED_HOSTNAMES.has(u.hostname)) {
      ctx.addIssue({
        code: "custom",
        message: proxyValidationMessages.host,
      });
    }
  })
  .transform((s) => new URL(s));

/** Paths the SPA actually calls, per upstream host. Everything else is refused. */
const PROXY_ALLOWED_PATHS: Record<string, RegExp[]> = {
  "api.themoviedb.org": [
    /^\/3\/search\/(?:movie|tv|multi)$/,
    /^\/3\/movie\/\d+(?:\/(?:credits|videos|images|release_dates|watch\/providers|external_ids))?$/,
    /^\/3\/tv\/\d+(?:\/(?:credits|videos|images|external_ids|season\/\d+))?$/,
    /^\/3\/(?:configuration|genre\/movie\/list|genre\/tv\/list)$/,
    /^\/3\/discover\/movie$/,
    /^\/3\/trending\/movie\/(?:day|week)$/,
    /^\/3\/find\/[A-Za-z0-9]+$/,
  ],
  "www.omdbapi.com": [/^\/$/, /^\/index\.html$/],
};

const PROXY_ALLOWED_PARAMS: Record<string, Set<string>> = {
  "api.themoviedb.org": new Set([
    "query",
    "page",
    "language",
    "region",
    "year",
    "primary_release_year",
    "first_air_date_year",
    "with_genres",
    "with_watch_providers",
    "watch_region",
    "with_release_type",
    "sort_by",
    "append_to_response",
    "include_adult",
  ]),
  "www.omdbapi.com": new Set(["t", "i", "s", "y", "type", "plot", "page"]),
};

export type ProxyTargetCheck = { ok: true } | { ok: false; message: string };

/**
 * Enforces the business layer of the proxy: only the upstream paths and query parameters
 * the SPA needs, and no caller-supplied credential parameter (the server injects its own).
 */
export function checkProxyTarget(url: URL): ProxyTargetCheck {
  const allowedPaths = PROXY_ALLOWED_PATHS[url.hostname];
  const allowedParams = PROXY_ALLOWED_PARAMS[url.hostname];
  if (!allowedPaths || !allowedParams) {
    return { ok: false, message: "Proxy target host is not allowed" };
  }
  if (!allowedPaths.some((pattern) => pattern.test(url.pathname))) {
    return { ok: false, message: "Proxy target path is not allowed" };
  }
  if (url.searchParams.has("api_key") || url.searchParams.has("apikey")) {
    return { ok: false, message: "Credential parameters must not be supplied by the caller" };
  }
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) {
      return { ok: false, message: `Proxy query parameter is not allowed: ${key}` };
    }
  }
  return { ok: true };
}

export type ParseProxyUrlResult =
  | { ok: true; url: URL }
  | {
      ok: false;
      status: typeof HTTP_STATUS_BAD_REQUEST | typeof HTTP_STATUS_FORBIDDEN;
      message: string;
    };

export function parseAllowedProxyUrl(raw: string): ParseProxyUrlResult {
  const result = proxyPathUrlSchema.safeParse(raw);
  if (result.success) return { ok: true, url: result.data };
  const msg = result.error.issues[0]?.message ?? proxyValidationMessages.invalid;
  const status = proxyHttpsOrHostMessages.has(msg)
    ? HTTP_STATUS_FORBIDDEN
    : HTTP_STATUS_BAD_REQUEST;
  return { ok: false, status, message: msg };
}

export const letterboxdWatchlistBodySchema = z
  .object({
    username: z.string().min(1, "Watchlist file not found").max(50),
    listUrl: z.string().min(1, "Invalid or missing watchlist URL").max(300),
    listType: z.string().max(50).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const parsed = parseLetterboxdListUrl(data.listUrl);
    if (!parsed || parsed.listType !== "watchlist") {
      ctx.addIssue({
        code: "custom",
        message: "Invalid or missing watchlist URL",
        path: ["listUrl"],
      });
      return;
    }
    if (parsed.username !== data.username) {
      ctx.addIssue({
        code: "custom",
        message: "Watchlist URL does not match username",
        path: ["username"],
      });
    }
  })
  .transform((data) => {
    const parsed = parseLetterboxdListUrl(data.listUrl)!;
    return {
      username: data.username,
      listType: data.listType,
      page: data.page ?? 1,
      parsedListUrl: parsed.listUrl,
    };
  });

export type LetterboxdWatchlistBodyOut = z.infer<typeof letterboxdWatchlistBodySchema>;

export const letterboxdCustomListBodySchema = z
  .object({
    username: z.string().min(1, "Username is required").max(50),
    listUrl: z.string().min(1, "Custom list URL not found").max(300),
    listType: z.string().max(50).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const parsed = parseLetterboxdListUrl(data.listUrl);
    if (!parsed || parsed.listType !== "custom list") {
      ctx.addIssue({
        code: "custom",
        message: "Invalid custom list URL",
        path: ["listUrl"],
      });
      return;
    }
    if (parsed.username !== data.username) {
      ctx.addIssue({
        code: "custom",
        message: "List URL does not match username",
        path: ["username"],
      });
    }
  })
  .transform((data) => {
    const parsed = parseLetterboxdListUrl(data.listUrl)!;
    return {
      username: data.username,
      listType: data.listType,
      page: data.page ?? 1,
      parsedListUrl: parsed.listUrl,
    };
  });

export type LetterboxdCustomListBodyOut = z.infer<typeof letterboxdCustomListBodySchema>;

export const alternativeSearchBodySchema = z.object({
  title: z.preprocess((v) => v ?? "", z.string().min(1, "Title is required").max(200)),
  year: z.union([z.string().max(4), z.number().int().min(1800).max(2100)]).optional(),
});

export type AlternativeSearchBody = z.infer<typeof alternativeSearchBodySchema>;

export const searchMovieBodySchema = z.object({
  title: z.preprocess((v) => v ?? "", z.string().min(1, "Title is required").max(200)),
  year: z.union([z.string().max(4), z.number().int().min(1800).max(2100)]).optional(),
  country: z.string().max(10).optional(),
});

export const posterBodySchema = z.object({
  title: z.preprocess((v) => v ?? "", z.string().min(1, "Title is required").max(200)),
  year: z.union([z.string().max(4), z.number().int().min(1800).max(2100)]).optional(),
});

export const letterboxdPosterBodySchema = z.object({
  filmId: z.string().min(1, "filmId is required"),
  filmSlug: z.string().min(1, "filmSlug is required"),
  cacheBustingKey: z.string().optional(),
});

export function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
