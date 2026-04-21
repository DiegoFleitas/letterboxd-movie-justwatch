/** Opens Letterboxd search for a film title (and optional year) in a new tab. */
export function openLetterboxdSearch(title: string, year?: string | number | null): void {
  if (!title.trim()) return;
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : null;
  const q = y ? `${title.trim()} ${y}` : title.trim();
  const url = `https://letterboxd.com/search/${encodeURIComponent(q)}/`;
  window.open(url, "_blank", "noopener,noreferrer");
}
