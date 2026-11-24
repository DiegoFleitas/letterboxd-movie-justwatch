let cachedRuntimeConfigJs: string | null = null;

/** Runtime config emitted by `injectRuntimeConfig` and served as `/runtime-config.js`. */
export function setRuntimeConfigJs(js: string): void {
  cachedRuntimeConfigJs = js;
}

export function getRuntimeConfigJs(): string | null {
  return cachedRuntimeConfigJs;
}
