declare module "cookie-session" {
  import type { RequestHandler } from "express";
  function cookieSession(options: {
    name?: string;
    keys: string[];
    maxAge?: number;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
  }): RequestHandler;
  export = cookieSession;
}

declare module "body-parser" {
  import type { RequestHandler } from "express";
  function urlencoded(options?: { extended?: boolean }): RequestHandler;
  function json(): RequestHandler;
}

declare module "diegos-fly-logger/index.mjs" {
  import type { RequestHandler } from "express";
  export const logging: RequestHandler;
}
