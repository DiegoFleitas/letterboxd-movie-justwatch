/// <reference types="vite/client" />

export function getPublicAssetPath(path: string, baseUrl = import.meta.env.BASE_URL): string {
  // Build URLs relative to Vite BASE_URL so static assets work on root and subpath deploys.
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}
