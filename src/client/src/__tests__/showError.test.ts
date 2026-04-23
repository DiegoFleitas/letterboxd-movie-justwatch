// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showError } from "../showError";
import { setToastImpl } from "../toastApi";

describe("showError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    setToastImpl(null);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    setToastImpl(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deduplicates the same error message within a short window", () => {
    const errorToast = vi.fn();
    setToastImpl({ error: errorToast });

    showError("Alternative search failed.");
    showError("Alternative search failed.");

    expect(errorToast).toHaveBeenCalledTimes(1);
  });

  it("allows the same message again after the dedupe window", () => {
    const errorToast = vi.fn();
    setToastImpl({ error: errorToast });
    const message = "Alternative search failed (retry).";

    showError(message);
    vi.advanceTimersByTime(3001);
    showError(message);

    expect(errorToast).toHaveBeenCalledTimes(2);
  });

  it("does not poison dedupe state when iziToast is undefined", () => {
    // No toast impl and no iziToast global → nothing shown, state must not be updated
    showError("msg");

    // Now set a real impl — the same message should still be shown
    const errorToast = vi.fn();
    setToastImpl({ error: errorToast });
    showError("msg");

    expect(errorToast).toHaveBeenCalledTimes(1);
  });

  it("does not poison dedupe state when toastCount >= 2", () => {
    const iziToastShow = vi.fn();
    (globalThis as { iziToast?: unknown }).iziToast = { show: iziToastShow };

    // Simulate 2 existing toasts so the call is skipped
    document.body.innerHTML =
      '<div class="iziToast-capsule"></div><div class="iziToast-capsule"></div>';
    showError("capped");

    // Remove the capsules so the next call can proceed
    document.body.innerHTML = "";
    showError("capped");

    expect(iziToastShow).toHaveBeenCalledTimes(1);

    delete (globalThis as { iziToast?: unknown }).iziToast;
  });
});
