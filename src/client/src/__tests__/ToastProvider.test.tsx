// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ToastProvider } from "../components/ToastProvider";
import { getToastImpl } from "../utils/toastApi";

/** Registered impl accepts broader payloads than `ToastApi` types (see ToastProvider). */
function messageWithLinkPayload(
  impl: NonNullable<ReturnType<typeof getToastImpl>>,
  data: unknown,
): void {
  (impl as { messageWithLink?: (d: unknown) => void }).messageWithLink?.(data);
}

async function renderToastProvider(ui: React.ReactElement): Promise<void> {
  render(ui);
  await waitFor(() => {
    expect(getToastImpl()).not.toBeNull();
  });
}

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastLoading = vi.fn();
const toastDismiss = vi.fn();
const toastCustom = vi.fn();

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    loading: (...args: unknown[]) => toastLoading(...args),
    dismiss: (...args: unknown[]) => toastDismiss(...args),
    custom: (...args: unknown[]) => toastCustom(...args),
  },
  Toaster: () => <div data-testid="toaster-stub" />,
}));

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("registers toast impl on mount and clears on unmount", async () => {
    const { unmount } = render(
      <ToastProvider>
        <span>child</span>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(getToastImpl()).not.toBeNull();
    });
    const impl = getToastImpl();
    expect(impl).not.toBeNull();
    expect(impl?.success).toEqual(expect.any(Function));

    unmount();
    expect(getToastImpl()).toBeNull();
  });

  it("routes success and error to react-hot-toast", async () => {
    await renderToastProvider(<ToastProvider>{"x"}</ToastProvider>);
    const impl = getToastImpl();
    expect(impl).not.toBeNull();

    impl?.success?.("ok");
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ className: "app-toast" }),
    );
    const successRender = toastSuccess.mock.calls[0][0] as (t: {
      id: string;
    }) => React.ReactElement;
    const successMarkup = renderToStaticMarkup(successRender({ id: "s1" }));
    expect(successMarkup).toContain("ok");
    expect(successMarkup).toContain('aria-label="Dismiss notification"');

    impl?.error?.("bad");
    expect(toastError).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        duration: Infinity,
        style: expect.objectContaining({ borderColor: "#b91c1c" }),
      }),
    );
    const errorRender = toastError.mock.calls[0][0] as (t: { id: string }) => React.ReactElement;
    const errorMarkup = renderToStaticMarkup(errorRender({ id: "e1" }));
    expect(errorMarkup).toContain("bad");
    expect(errorMarkup).toContain('aria-label="Dismiss notification"');
  });

  it("clicking the dismiss button dismisses that specific toast", async () => {
    await renderToastProvider(<ToastProvider>{"x"}</ToastProvider>);
    const impl = getToastImpl();

    impl?.error?.("boom");
    const errorRender = toastError.mock.calls[0][0] as (t: { id: string }) => React.ReactElement;

    const { getByRole } = render(errorRender({ id: "toast-42" }));
    fireEvent.click(getByRole("button", { name: "Dismiss notification" }));
    expect(toastDismiss).toHaveBeenCalledWith("toast-42");
  });

  it("link toast dismiss button dismisses that specific toast", async () => {
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    const impl = getToastImpl();
    messageWithLinkPayload(impl!, { url: "https://example.com/x", text: "Open" });
    const [renderFn] = toastCustom.mock.calls[0] as [(t: { id: string }) => React.ReactElement];

    const { getByRole } = render(renderFn({ id: "link-7" }));
    fireEvent.click(getByRole("button", { name: "Dismiss notification" }));
    expect(toastDismiss).toHaveBeenCalledWith("link-7");
  });

  it("loading uses default copy when message is nullish", async () => {
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    const impl = getToastImpl();
    impl?.loading?.(undefined as unknown as string);
    expect(toastLoading).toHaveBeenCalledWith(
      "Please wait...",
      expect.objectContaining({ position: "top-right" }),
    );
  });

  it("dismissLoading forwards to toast.dismiss", async () => {
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    getToastImpl()?.dismissLoading?.("tid");
    expect(toastDismiss).toHaveBeenCalledWith("tid");
  });

  it("messageWithLink uses toast.custom for valid object without error", async () => {
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    const impl = getToastImpl();
    messageWithLinkPayload(impl!, { url: "https://example.com/path", text: "Open" });

    expect(toastCustom).toHaveBeenCalledTimes(1);
    const [renderFn, opts] = toastCustom.mock.calls[0] as [
      (t: { id: string }) => React.ReactElement,
      Record<string, unknown>,
    ];
    expect(opts).toMatchObject({ duration: Infinity, position: "top-right" });

    const markup = renderToStaticMarkup(renderFn({ id: "l1" }));
    expect(markup).toContain('href="https://example.com/path"');
    expect(markup).toContain(">Open</a>");
    expect(markup).toContain('aria-label="Dismiss notification"');
  });

  it("messageWithLink falls back to toast.success for null, string, and error object", async () => {
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    const impl = getToastImpl()!;

    messageWithLinkPayload(impl, null);
    expect(toastSuccess).toHaveBeenLastCalledWith("Done", expect.any(Object));

    messageWithLinkPayload(impl, "plain");
    expect(toastSuccess).toHaveBeenLastCalledWith("plain", expect.any(Object));

    messageWithLinkPayload(impl, { error: "e", text: "ignored" });
    expect(toastSuccess).toHaveBeenLastCalledWith("ignored", expect.any(Object));
  });

  it("messageWithLink uses custom toast when object has no error even if url missing", async () => {
    vi.clearAllMocks();
    await renderToastProvider(<ToastProvider>{null}</ToastProvider>);
    const impl = getToastImpl()!;
    messageWithLinkPayload(impl, { text: "label only" });
    expect(toastCustom).toHaveBeenCalledTimes(1);
    const [renderFn] = toastCustom.mock.calls[0] as [(t: { id: string }) => React.ReactElement];
    const markup = renderToStaticMarkup(renderFn({ id: "l2" }));
    expect(markup).toContain('href="#"');
    expect(markup).toContain(">label only</a>");
  });
});
