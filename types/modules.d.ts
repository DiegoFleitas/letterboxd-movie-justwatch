declare module "diegos-fly-logger/index.mjs" {
  import type { IncomingMessage, ServerResponse } from "http";

  /** Morgan middleware — use with Node raw request/response on Fastify. */
  export const logging: (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => void;
}
