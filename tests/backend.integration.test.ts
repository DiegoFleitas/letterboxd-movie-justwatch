import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createServer } from "../server/createServer.js";

type Framework = "express" | "fastify";

const frameworks: Framework[] = ["express", "fastify"];

for (const framework of frameworks) {
  describe(`backend integration (${framework})`, () => {
    let baseUrl: string;
    let closeServer: (() => Promise<void>) | null = null;

    beforeAll(async () => {
      const created = createServer({ framework });
      const { port, close } = await created.start(0);
      baseUrl = `http://127.0.0.1:${port}`;
      closeServer = close;
    });

    afterAll(async () => {
      if (closeServer) {
        await closeServer();
        closeServer = null;
      }
    });

    it("GET /healthcheck returns OK", async () => {
      const res = await fetch(`${baseUrl}/healthcheck`);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(text).toBe("OK");
    });

    it("GET /redis-healthcheck returns 200 or 500", async () => {
      const res = await fetch(`${baseUrl}/redis-healthcheck`);
      const text = await res.text();

      expect([200, 500]).toContain(res.status);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(typeof text).toBe("string");
    });

    it.skipIf(!process.env.MOVIE_DB_API_KEY)("POST /api/search-movie responds with JSON shape", async () => {
      const res = await fetch(`${baseUrl}/api/search-movie`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Inception",
          country: "US",
        }),
      });

      expect(res.status).toBe(200);
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");

      const body = await res.json();

      expect(body).toBeTypeOf("object");
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("title");
    });
  });
}
