/// <reference types="vite/client" />

// Merged onto Vite's `ImportMetaEnv` for `import.meta.env` typing; name is not referenced in this file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ambient interface merge
interface ImportMetaEnv {
  /** `"false"` hides the dev debug bar during `vite dev`. Omitted = visible in dev. No effect in production builds. */
  readonly VITE_DEV_DEBUG_BAR?: string;
}

declare global {
  interface Window {
    __POSTHOG_KEY__?: string;
    __POSTHOG_HOST__?: string;
    __SENTRY_DSN__?: string;
    __SENTRY_RELEASE__?: string;
    __SENTRY_TRACES_SAMPLE_RATE__?: string;
    __SENTRY_SEND_DEFAULT_PII__?: string;
    __SENTRY_ENVIRONMENT__?: string;
    __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }>;
  }
}

declare module "react-hot-toast" {
  import type { ReactElement } from "react";
  const toast: {
    success: (msg: string, opts?: object) => void;
    error: (msg: string, opts?: object) => void;
    loading: (msg: string, opts?: object) => string;
    dismiss: (id?: string) => void;
    custom: (component: () => ReactElement) => void;
  };
  export function Toaster(props: {
    position?: string;
    containerClassName?: string;
    toastOptions?: object;
  }): ReactElement;
  export default toast;
}

export {};
