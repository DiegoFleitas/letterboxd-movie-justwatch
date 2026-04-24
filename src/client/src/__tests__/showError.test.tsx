// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showError, showBatchErrors } from "../showError";
import { setToastImpl } from "../toastApi";

describe("showError", () => {
  beforeEach(() => {
    setToastImpl(null);
  });

  afterEach(() => {
    setToastImpl(null);
    vi.restoreAllMocks();
  });

  it("dedupes identical errors within the window", () => {
    const err = vi.fn();
    setToastImpl({
      success: vi.fn(),
      error: err,
      loading: vi.fn(),
      dismissLoading: vi.fn(),
    });
    showError("same");
    showError("same");
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("uses iziToast when no toast impl and iziToast exists", () => {
    const show = vi.fn();
    (globalThis as { iziToast?: { show: typeof show } }).iziToast = { show };
    vi.spyOn(document, "querySelectorAll").mockReturnValue({
      length: 0,
    } as unknown as NodeListOf<Element>);
    showError("boom");
    expect(show).toHaveBeenCalled();
  });

  it("skips iziToast when too many visible toasts", () => {
    const show = vi.fn();
    (globalThis as { iziToast?: { show: typeof show } }).iziToast = { show };
    vi.spyOn(document, "querySelectorAll").mockReturnValue({
      length: 3,
    } as unknown as NodeListOf<Element>);
    showError("x");
    expect(show).not.toHaveBeenCalled();
  });
});

describe("showBatchErrors", () => {
  const errorFn = vi.fn();

  beforeEach(() => {
    errorFn.mockClear();
    setToastImpl({
      success: vi.fn(),
      error: errorFn,
      loading: vi.fn(),
      dismissLoading: vi.fn(),
    });
  });

  afterEach(() => {
    setToastImpl(null);
  });

  it("no-ops on empty list", () => {
    showBatchErrors([]);
    showBatchErrors(undefined);
    expect(errorFn).not.toHaveBeenCalled();
  });

  it("formats single batch error", () => {
    showBatchErrors([{ title: "A", year: 1, message: "m1" }]);
    expect(errorFn).toHaveBeenCalledWith(expect.stringContaining("A"));
  });

  it("formats multiple errors with unique messages", () => {
    showBatchErrors([
      { title: "A", year: 1, message: "x" },
      { title: "B", year: 2, message: "y" },
    ]);
    expect(errorFn).toHaveBeenCalledWith(expect.stringContaining("2 titles"));
    expect(errorFn.mock.calls[0][0]).toContain("x");
    expect(errorFn.mock.calls[0][0]).toContain("y");
  });

  it("formats multiple errors with same message", () => {
    showBatchErrors([
      { title: "A", year: 1, message: "same" },
      { title: "B", year: 2, message: "same" },
    ]);
    expect(errorFn.mock.calls[0][0]).toContain("2 titles: same");
  });

  it("formats when messages are empty", () => {
    showBatchErrors([
      { title: "A", year: 1, message: "" },
      { title: "B", year: 2, message: "" },
    ]);
    expect(errorFn.mock.calls[0][0]).toContain("2 titles encountered errors");
  });
});
