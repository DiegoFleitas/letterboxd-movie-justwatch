import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";

describe("justWatchOutbound", () => {
  it("recordJustWatchHttpAttempt increments for axios errors with status", async () => {
    const { recordJustWatchHttpAttempt, getJustWatchHttpErrorSnapshot } =
      await import("@server/lib/justWatchOutbound.js");
    const err = new AxiosError("fail", "ERR", undefined, undefined, {
      status: 502,
      statusText: "Bad",
      data: {},
      headers: {},
      config: {} as never,
    });
    recordJustWatchHttpAttempt(err);
    const snap = getJustWatchHttpErrorSnapshot();
    expect(snap.total).toBeGreaterThanOrEqual(1);
    expect(snap.byStatus["502"]).toBeGreaterThanOrEqual(1);
  });

  it("recordJustWatchHttpAttempt uses status 0 for non-axios errors", async () => {
    const { recordJustWatchHttpAttempt, getJustWatchHttpErrorSnapshot } =
      await import("@server/lib/justWatchOutbound.js");
    const before = getJustWatchHttpErrorSnapshot().total;
    recordJustWatchHttpAttempt(new Error("timeout"));
    const after = getJustWatchHttpErrorSnapshot();
    expect(after.total).toBe(before + 1);
    expect(after.byStatus["0"]).toBeGreaterThanOrEqual(1);
  });

  it("ignores 2xx axios responses", async () => {
    const { recordJustWatchHttpAttempt, getJustWatchHttpErrorSnapshot } =
      await import("@server/lib/justWatchOutbound.js");
    const before = getJustWatchHttpErrorSnapshot().total;
    const err = new AxiosError("ok", "ERR", undefined, undefined, {
      status: 200,
      statusText: "OK",
      data: {},
      headers: {},
      config: {} as never,
    });
    recordJustWatchHttpAttempt(err);
    const after = getJustWatchHttpErrorSnapshot().total;
    expect(after).toBe(before);
  });
});
