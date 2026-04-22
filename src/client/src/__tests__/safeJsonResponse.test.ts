import { describe, it, expect } from "vitest";
import { SafeJsonResponseError, safeJsonResponse } from "../safeJsonResponse";

function createJsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

describe("safeJsonResponse", () => {
  it("parses valid json response", async () => {
    const response = createJsonResponse(JSON.stringify({ ok: true }));
    await expect(safeJsonResponse<{ ok: boolean }>(response)).resolves.toEqual({ ok: true });
  });

  it("throws typed error for non-json content type", async () => {
    const response = new Response("upstream error", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
    await expect(safeJsonResponse(response)).rejects.toMatchObject({
      kind: "non-json-content-type",
      status: 502,
    });
  });

  it("throws typed error for empty json body", async () => {
    const response = createJsonResponse("", 502);
    await expect(safeJsonResponse(response)).rejects.toMatchObject({
      kind: "empty-body",
      status: 502,
    });
  });

  it("throws typed error for invalid json body", async () => {
    const response = createJsonResponse("{", 502);
    await expect(safeJsonResponse(response)).rejects.toMatchObject({
      kind: "invalid-json",
      status: 502,
    });
  });

  it("exposes status and body snippet for diagnostics", async () => {
    const response = new Response("not json body", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });

    try {
      await safeJsonResponse(response);
    } catch (error) {
      expect(error).toBeInstanceOf(SafeJsonResponseError);
      const typedError = error as SafeJsonResponseError;
      expect(typedError.status).toBe(500);
      expect(typedError.bodySnippet).toContain("not json body");
      return;
    }

    throw new Error("Expected safeJsonResponse to throw");
  });
});
