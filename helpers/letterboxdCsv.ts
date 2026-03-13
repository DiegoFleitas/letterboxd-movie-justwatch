/**
 * Parser for Letterboxd import CSV format.
 * See https://letterboxd.com/about/importing-data/
 * Columns: LetterboxdURI (or url), Title, Year (any order); UTF-8, comma-delimited, quoted strings for values with commas.
 */

export interface LetterboxdCsvRow {
  title: string | null;
  year: string | null;
  link: string;
}

/**
 * Parse a single CSV line respecting double-quoted fields (commas inside quotes are not delimiters).
 * Does not handle escaped quotes inside quoted fields (Letterboxd uses backslash-escape).
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) {
      if (c === "\\" && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        current += c;
      }
      continue;
    }
    if (c === ",") {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  result.push(current.trim());
  return result;
}

/**
 * Find case-insensitive column index for a header. Prefer exact match, then lowercase match.
 */
function findColumnIndex(headerRow: string[], name: string): number {
  const lower = name.toLowerCase();
  const idx = headerRow.findIndex((h) => h.trim().toLowerCase() === lower);
  return idx;
}

/**
 * Normalize a Letterboxd URI to https://letterboxd.com/... for consistency.
 * boxd.it short URLs are left as-is (we don't resolve redirects).
 */
function normalizeLink(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("https://letterboxd.com") || v.startsWith("http://letterboxd.com")) return v;
  if (v.startsWith("https://www.letterboxd.com") || v.startsWith("http://www.letterboxd.com"))
    return v;
  return v;
}

/**
 * Parse Letterboxd import CSV into rows with title, year, link.
 * Requires a header row with at least one of: LetterboxdURI (or url), Title.
 * Empty rows and rows with no title/URI are skipped.
 *
 * @throws Error if CSV is empty, has no header, or has no valid data rows
 */
export function parseLetterboxdCsv(csv: string): LetterboxdCsvRow[] {
  const trimmed = csv.trim();
  if (!trimmed) {
    throw new Error("CSV content is empty");
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headerLine = lines[0];
  const headerCells = parseCsvLine(headerLine);
  const uriIdx =
    findColumnIndex(headerCells, "LetterboxdURI") >= 0
      ? findColumnIndex(headerCells, "LetterboxdURI")
      : findColumnIndex(headerCells, "url");
  const titleIdx = findColumnIndex(headerCells, "Title");
  const yearIdx = findColumnIndex(headerCells, "Year");

  if (uriIdx < 0 && titleIdx < 0) {
    throw new Error("CSV must contain a 'LetterboxdURI' or 'url' column, or a 'Title' column");
  }

  const rows: LetterboxdCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const link = uriIdx >= 0 && cells[uriIdx] ? normalizeLink(cells[uriIdx]) : "";
    const title = titleIdx >= 0 && cells[titleIdx] ? cells[titleIdx].trim() || null : null;
    const year = yearIdx >= 0 && cells[yearIdx] ? cells[yearIdx].trim() || null : null;

    if (!title && !link) continue;
    rows.push({
      title: title || null,
      year: year || null,
      link: link || "",
    });
  }

  if (rows.length === 0) {
    throw new Error("CSV has no valid data rows (need Title and/or LetterboxdURI/url)");
  }

  return rows;
}
