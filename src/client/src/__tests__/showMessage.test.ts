// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showMessage, plainText } from "../showMessage";
import { setToastImpl } from "../toastApi";

describe("plainText", () => {
  it("strips HTML and br tags", () => {
    expect(plainText("a<br/>b<p>x</p>")).toBe("a\nbx");
  });

  it("returns empty for non-string", () => {
    expect(plainText(1)).toBe("");
  });
});

describe("showMessage", () => {
  beforeEach(() => {
    setToastImpl(null);
  });

  afterEach(() => {
    setToastImpl(null);
    vi.restoreAllMocks();
  });

  it("uses toast success when impl is set", () => {
    const success = vi.fn();
    setToastImpl({ success, error: vi.fn(), loading: vi.fn(), dismissLoading: vi.fn() });
    showMessage("hello");
    expect(success).toHaveBeenCalledWith("hello");
  });

  it("uses messageWithLink when isHTML and impl supports it", () => {
    const messageWithLink = vi.fn();
    setToastImpl({
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
      dismissLoading: vi.fn(),
      messageWithLink,
    });
    showMessage({ text: "t", url: "https://example.com/path" }, true);
    expect(messageWithLink).toHaveBeenCalledWith({ text: "t", url: "https://example.com/path" });
  });

  it("falls back to success with plain text from object when not HTML mode", () => {
    const success = vi.fn();
    setToastImpl({ success, error: vi.fn(), loading: vi.fn(), dismissLoading: vi.fn() });
    showMessage({ text: "line<br/>two" }, false);
    expect(success).toHaveBeenCalledWith("line\ntwo");
  });

  it("queues for iziToast when three toasts visible and isHTML", () => {
    const show = vi.fn();
    (globalThis as { iziToast?: { show: typeof show } }).iziToast = { show };
    vi.spyOn(document, "querySelectorAll").mockReturnValue({
      length: 3,
    } as unknown as NodeListOf<Element>);
    showMessage({ text: "q", url: "https://a.com" }, true);
    expect(show).not.toHaveBeenCalled();
  });

  it("uses iziToast.show for plain string when impl missing", () => {
    const show = vi.fn();
    (globalThis as { iziToast?: { show: typeof show } }).iziToast = { show };
    vi.spyOn(document, "querySelectorAll").mockReturnValue({
      length: 0,
    } as unknown as NodeListOf<Element>);
    showMessage("plain");
    expect(show).toHaveBeenCalled();
  });
});
