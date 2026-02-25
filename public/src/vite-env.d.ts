/// <reference types="vite/client" />

interface Window {
  __POSTHOG_KEY__?: string;
  __POSTHOG_HOST__?: string;
  __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }>;
}

declare module "react-hot-toast" {
  import type { ReactElement } from "react";
  const toast: {
    success: (msg: string, opts?: object) => void;
    error: (msg: string, opts?: object) => void;
    loading: (msg: string, opts?: object) => string;
    dismiss: (id?: string) => void;
    custom: (component: () => ReactElement, opts?: object) => void;
  };
  export function Toaster(props: {
    position?: string;
    containerClassName?: string;
    toastOptions?: object;
  }): ReactElement;
  export default toast;
}
