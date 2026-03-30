import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import createAxios from "../helpers/axios.js";

describe("axios logging sanitizer", () => {
  const originalLog = console.log;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log = originalLog;
    vi.restoreAllMocks();
  });

  it("redacts api_key and apikey query params in logged URLs", async () => {
    const client = createAxios();

    await client
      .get(
        "https://api.example.com/search?query=Inception&api_key=REAL_TMDB_KEY&apikey=REAL_OMDB_KEY",
      )
      .catch(() => {
        // We only care about the logged URL, not the network response.
      });

    const spy = vi.mocked(console.log);
    const calls = spy.mock.calls
      .map((args: unknown[]) => String(args[0]))
      .filter((msg: string) => msg.startsWith("[axios] Sending request to "));

    expect(calls.length).toBeGreaterThan(0);
    const msg = calls[0];
    expect(msg).toContain("api_key=***");
    expect(msg).toContain("apikey=***");
    expect(msg).not.toContain("REAL_TMDB_KEY");
    expect(msg).not.toContain("REAL_OMDB_KEY");
  });
});
