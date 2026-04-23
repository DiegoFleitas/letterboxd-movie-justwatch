import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerFastifyStaticAndIndex } from "@server/registerFastifyStaticAndIndex.js";
import { HTTP_STATUS_NOT_FOUND } from "@server/httpStatusCodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.join(__dirname, "..", "src", "client", "dist");

describe.skipIf(!fs.existsSync(clientDistPath))("registerFastifyStaticAndIndex", () => {
  it("GET / returns 404 when cached index html is null", async () => {
    const app = Fastify({ logger: false });
    registerFastifyStaticAndIndex(app, null);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
    await app.close();
  });

  it("GET / returns 200 html when cached index is provided", async () => {
    const app = Fastify({ logger: false });
    registerFastifyStaticAndIndex(app, "<!doctype html><title>unit</title>");
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/html");
    expect(res.body).toContain("<title>unit</title>");
    await app.close();
  });
});
