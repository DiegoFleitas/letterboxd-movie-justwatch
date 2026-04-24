import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LetterboxdHttpError,
  buildLetterboxdHtmlRequestHeaders,
  buildLetterboxdImageRequestHeaders,
  fetchLetterboxdBinaryOk,
  fetchLetterboxdHtml,
} from "@server/lib/letterboxdHttp.js";

describe("letterboxdHttp", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("LETTERBOXD_FETCH_TIMEOUT_MS", "5000");
    vi.stubEnv("AXIOS_429_MAX_RETRIES", "3");
    vi.stubEnv("AXIOS_429_MAX_RETRY_AFTER_SECONDS", "1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("buildLetterboxdHtmlRequestHeaders includes UA and Accept", () => {
    const h = buildLetterboxdHtmlRequestHeaders("MyAgent/1");
    expect(h["User-Agent"]).toBe("MyAgent/1");
    expect(h.Referer).toBe("https://letterboxd.com/");
    expect(h.Accept).toContain("text/html");
  });

  it("buildLetterboxdImageRequestHeaders includes image Accept", () => {
    const h = buildLetterboxdImageRequestHeaders("ImgBot/2");
    expect(h.Accept).toContain("image/");
  });

  it("fetchLetterboxdHtml returns text for ok HTML response", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><body>ok</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const html = await fetchLetterboxdHtml("https://letterboxd.com/x/", { "User-Agent": "t" });
    expect(html).toContain("ok");
  });

  it("fetchLetterboxdHtml throws LetterboxdHttpError on HTTP error", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 404, headers: { "content-type": "text/html" } }),
    );
    await expect(fetchLetterboxdHtml("https://letterboxd.com/missing/", {})).rejects.toThrow(
      LetterboxdHttpError,
    );
  });

  it("fetchLetterboxdHtml throws on non-HTML content type", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(fetchLetterboxdHtml("https://letterboxd.com/x/", {})).rejects.toMatchObject({
      name: "LetterboxdHttpError",
    });
  });

  it("fetchLetterboxdBinaryOk succeeds for image content-type", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    await expect(
      fetchLetterboxdBinaryOk("https://a.ltrbxd.com/poster.jpg", {}),
    ).resolves.toBeUndefined();
  });

  it("fetchLetterboxdBinaryOk throws on wrong content type", async () => {
    fetchMock.mockResolvedValue(
      new Response("x", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    await expect(fetchLetterboxdBinaryOk("https://a.ltrbxd.com/x", {})).rejects.toThrow(
      LetterboxdHttpError,
    );
  });

  it("retries after 429 then returns response", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    const p = fetchLetterboxdHtml("https://letterboxd.com/list/", {});
    await vi.advanceTimersByTimeAsync(1500);
    const html = await p;
    expect(html).toContain("html");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
