declare global {
  namespace Express {
    interface Application {
      locals: {
        canonicalProviderMap?: Record<string, { id: string; name: string }>;
      };
    }
  }
}

export {};
