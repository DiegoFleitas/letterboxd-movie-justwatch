declare global {
  interface Window {
    __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }>;
  }
}

export {};
