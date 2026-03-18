/**
 * Hits the real Fastify server (not Vite). Fails if the API is down even when
 * app.spec.ts passes (those tests mock /api/* in the browser).
 * Base URL: E2E_API_BASE_URL or http://127.0.0.1:3000 — see e2e/README.md.
 */
import { test, expect } from "@playwright/test";

const apiBase = (process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

test.describe("Backend smoke (real API)", () => {
  test("GET /healthcheck returns OK", async ({ request }) => {
    const res = await request.get(`${apiBase}/healthcheck`);
    expect(res.status(), `${apiBase}/healthcheck`).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("GET /redis-healthcheck returns 200", async ({ request }) => {
    const res = await request.get(`${apiBase}/redis-healthcheck`);
    expect(res.status(), `${apiBase}/redis-healthcheck`).toBe(200);
    const text = await res.text();
    expect(text === "OK" || text === "OK (Redis disabled)").toBeTruthy();
  });
});
