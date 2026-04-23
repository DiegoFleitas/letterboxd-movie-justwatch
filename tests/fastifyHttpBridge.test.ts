import Fastify, { type FastifyInstance } from "fastify";
import { describe, it, expect } from "vitest";
import { createFastifyHttpBinder } from "@server/fastifyHttpBridge.js";

type AppWithLocals = FastifyInstance & { locals?: Record<string, unknown> };

describe("createFastifyHttpBinder", () => {
  it("maps Fastify request into HttpRequestContext for the handler", async () => {
    const app = Fastify({ logger: false });
    (app as AppWithLocals).locals = {
      canonicalProviderMap: { provider: "test-map" },
    };
    const { makeFastifyHandler } = createFastifyHttpBinder(app);

    app.post(
      "/echo",
      makeFastifyHandler(async ({ req, res }) => {
        expect(req.method).toBe("POST");
        expect(req.url).toMatch(/^\/echo(\?|$)/);
        expect(req.query).toEqual({ q: "1" });
        expect(req.body).toEqual({ hello: "world" });
        expect(req.params).toEqual({});
        expect(typeof req.headers.host).toBe("string");
        expect(req.appLocals.canonicalProviderMap).toEqual({ provider: "test-map" });
        res.status(201).json({ ok: true });
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/echo?q=1",
      headers: { "content-type": "application/json" },
      payload: { hello: "world" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it("setCacheControlFastify adds Cache-Control before invoking the handler", async () => {
    const app = Fastify({ logger: false });
    (app as AppWithLocals).locals = {};
    const { setCacheControlFastify } = createFastifyHttpBinder(app);

    app.get(
      "/cached",
      setCacheControlFastify(async ({ res }) => {
        res.json({ done: true });
      }),
    );

    const res = await app.inject({ method: "GET", url: "/cached" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    expect(res.json()).toEqual({ done: true });
    await app.close();
  });
});
