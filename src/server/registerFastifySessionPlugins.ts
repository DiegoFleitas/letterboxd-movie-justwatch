import type { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyFormbody from "@fastify/formbody";

export function registerFastifySessionPlugins(app: FastifyInstance): void {
  const appSecretKey = process.env.APP_SECRET_KEY;
  if (!appSecretKey && process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET_KEY environment variable must be set in production.");
  }
  /** @fastify/session requires secret length ≥ 32 */
  const sessionSecret = appSecretKey || "dev-only-session-secret-do-not-use-in-production!!";

  void app.register(fastifyCookie, {
    secret: sessionSecret,
  });

  void app.register(fastifySession, {
    secret: sessionSecret,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    },
  });

  void app.register(fastifyFormbody);
}
