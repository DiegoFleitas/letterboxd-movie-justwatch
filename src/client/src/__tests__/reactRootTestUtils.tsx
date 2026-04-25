import type { ReactElement } from "react";
import { act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";

export function mockFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** createRoot on a detached div; unmount only (no body append). */
export async function withRootRender<T>(
  ui: ReactElement,
  run: (ctx: { container: HTMLDivElement; root: Root }) => Promise<T>,
): Promise<T> {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  try {
    return await run({ container, root });
  } finally {
    await act(async () => {
      root.unmount();
    });
  }
}

/** Appends container to document.body, then createRoot + render + cleanup. */
export async function withMountedInBody<T>(
  ui: ReactElement,
  run: (ctx: { container: HTMLDivElement; root: Root }) => Promise<T>,
): Promise<T> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  try {
    return await run({ container, root });
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
}
