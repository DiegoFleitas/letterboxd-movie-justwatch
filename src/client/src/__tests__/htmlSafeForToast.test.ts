import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeHrefForToast } from "../htmlSafeForToast";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`a & b <c> "d" 'e'`)).toBe("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;");
  });

  it("returns empty string for non-strings", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(1)).toBe("");
  });
});

describe("sanitizeHrefForToast", () => {
  it("allows https URLs", () => {
    expect(sanitizeHrefForToast("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("rejects mailto and tel", () => {
    expect(sanitizeHrefForToast("mailto:user@example.com")).toBe("#");
    expect(sanitizeHrefForToast("tel:+15551234567")).toBe("#");
  });

  it("rejects javascript URLs", () => {
    expect(sanitizeHrefForToast("javascript:alert(1)")).toBe("#");
  });

  it("returns hash for empty or invalid", () => {
    expect(sanitizeHrefForToast("")).toBe("#");
    expect(sanitizeHrefForToast("   ")).toBe("#");
    expect(sanitizeHrefForToast(null)).toBe("#");
    expect(sanitizeHrefForToast("not a url")).toBe("#");
  });
});
