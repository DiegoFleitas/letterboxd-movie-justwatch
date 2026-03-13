/**
 * Pure URL parsing for Letterboxd watchlist and custom list URLs.
 * Used by the frontend to decide which API to call; testable without React.
 */

export interface ParsedLetterboxdListUrl {
  username: string;
  listType: "watchlist" | "custom list";
  listUrl: string;
}

/**
 * Normalizes and parses a Letterboxd list URL (watchlist or custom list).
 * Supports https://letterboxd.com/ and https://www.letterboxd.com/.
 *
 * @param input - Raw input (URL with or without trailing slash, with or without /page/N)
 * @returns Parsed data or null if the input is not a valid Letterboxd list URL
 */
export function parseLetterboxdListUrl(input: string): ParsedLetterboxdListUrl | null {
  if (!input || typeof input !== "string") return null;
  let url = input.trim();
  if (!url) return null;

  url = url.split("/page")[0];
  if (!url.includes("watchlist") && !url.includes("list")) url += "/watchlist";
  if (!url.endsWith("/")) url += "/";

  // Allow optional www.
  const match = url.match(
    /^https:\/\/(www\.)?letterboxd\.com\/([^/]+)\/(watchlist|list\/[^/]+)\/$/,
  );
  if (!match) return null;

  const username = match[2];
  const pathPart = match[3];
  const listType = pathPart.startsWith("list/") ? "custom list" : "watchlist";

  return {
    username,
    listType,
    listUrl: url,
  };
}

/**
 * Returns true if the input looks like a Letterboxd list URL (before or after normalization).
 * Used to decide whether to treat input as URL or CSV.
 */
export function isLetterboxdListUrlInput(input: string): boolean {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return false;
  return (
    trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("www.")
  );
}
