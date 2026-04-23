import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { HttpHandler, HttpRequestContext, HttpResponseContext } from "./httpContext.js";

type AppLocals = { canonicalProviderMap?: unknown; [key: string]: unknown };

export type FastifyRouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface FastifyHttpBinder {
  makeFastifyHandler: (handler: HttpHandler) => FastifyRouteHandler;
  setCacheControlFastify: (handler: HttpHandler) => FastifyRouteHandler;
}

function getAppLocals(app: FastifyInstance): AppLocals {
  return ((app as FastifyInstance & { locals?: AppLocals }).locals ?? {}) as AppLocals;
}

export function createFastifyHttpBinder(app: FastifyInstance): FastifyHttpBinder {
  const makeFastifyHandler =
    (handler: HttpHandler) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const locals = getAppLocals(app);

      const reqContext: HttpRequestContext = {
        body: request.body ?? {},
        params: (request.params as Record<string, unknown>) ?? {},
        query: (request.query as Record<string, unknown>) ?? {},
        headers: (request.headers as Record<string, unknown>) ?? {},
        method: request.method,
        url: request.url,
        cookies: ((request as FastifyRequest & { cookies?: Record<string, unknown> }).cookies ??
          {}) as Record<string, unknown>,
        session: (request as FastifyRequest & { session?: unknown }).session ?? null,
        appLocals: {
          canonicalProviderMap: locals.canonicalProviderMap,
        },
      };

      const resContext: HttpResponseContext = {
        status(code: number): HttpResponseContext {
          reply.code(code);
          return this;
        },
        json(payload: unknown): void {
          reply.send(payload);
        },
        send(payload?: unknown): void {
          if (payload === undefined) {
            reply.send();
          } else {
            reply.send(payload);
          }
        },
        setHeader(name: string, value: string | number | readonly string[]): HttpResponseContext {
          reply.header(name, value);
          return this;
        },
      };

      await handler({ req: reqContext, res: resContext });
    };

  const setCacheControlFastify =
    (handler: HttpHandler) => async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header("Cache-Control", "public, max-age=3600");
      await makeFastifyHandler(handler)(request, reply);
    };

  return { makeFastifyHandler, setCacheControlFastify };
}
