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
    username: z.string().min(1, "Watchlist file not found"),
    listUrl: z.string().min(1, "Invalid or missing watchlist URL"),
    listType: z.string().optional(),
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
    username: z.string().optional(),
    listUrl: z.string().min(1, "Custom list URL not found"),
    listType: z.string().optional(),
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
    if (data.username !== undefined && data.username !== "" && parsed.username !== data.username) {
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
      username: data.username ?? "",
      listType: data.listType,
      page: data.page ?? 1,
      parsedListUrl: parsed.listUrl,
    };
  });

export type LetterboxdCustomListBodyOut = z.infer<typeof letterboxdCustomListBodySchema>;

export const alternativeSearchBodySchema = z.object({
  title: z.preprocess(
    (v) => (v === undefined || v === null ? "" : v),
    z.string().min(1, "Title is required"),
  ),
  year: z.union([z.string(), z.number()]).optional(),
});

export type AlternativeSearchBody = z.infer<typeof alternativeSearchBodySchema>;

export function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
