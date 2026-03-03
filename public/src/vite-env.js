// Runtime shim for Vite env-dependent globals used in the frontend.
// Intentionally minimal so that any stale imports of "./vite-env.js" resolve
// without breaking the dev server or Playwright E2E runs.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.__CANONICAL_PROVIDERS_BY_NAME__ = window.__CANONICAL_PROVIDERS_BY_NAME__ || {};

