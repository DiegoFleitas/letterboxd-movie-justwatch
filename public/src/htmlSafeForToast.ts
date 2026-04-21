const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Safe href for a literal <a href="…"> in third-party HTML toast (http / https only). */
export function sanitizeHrefForToast(url: unknown): string {
  if (typeof url !== "string" || url.trim() === "") return "#";
  const t = url.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) return "#";
  try {
    const parsed = new URL(t);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return "#";
    return parsed.href;
  } catch {
    return "#";
  }
}
