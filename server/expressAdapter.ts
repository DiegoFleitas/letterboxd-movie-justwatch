import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Request, Response } from "express";

type ExpressHandler = (req: Request, res: Response) => Promise<void> | void;

function createExpressLikeResponse(reply: FastifyReply): Response {
  const res: Partial<Response> = {};

  (res as Response).status = (code: number) => {
    reply.status(code);
    return res as Response;
  };

  (res as Response).json = (body: unknown) => {
    reply.send(body);
    return res as Response;
  };

  (res as Response).send = (body?: unknown) => {
    if (body === undefined) {
      reply.send();
    } else {
      reply.send(body);
    }
    return res as Response;
  };

  (res as Response).setHeader = (name: string, value: string | number | readonly string[]) => {
    reply.header(name, value);
    return res as Response;
  };

  return res as Response;
}

export function createFastifyExpressAdapter(app: FastifyInstance) {
  const locals = ((app as unknown as { locals?: { [key: string]: unknown } }).locals || {}) as {
    [key: string]: unknown;
  };

  return function adapt(handler: ExpressHandler) {
    return async function fastifyHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const expressReq = {
        body: request.body,
        params: request.params,
        query: request.query,
        headers: request.headers,
        method: request.method,
        originalUrl: request.url,
        app: { locals },
      } as unknown as Request;

      const expressRes = createExpressLikeResponse(reply);

      await handler(expressReq, expressRes);
    };
  };
}
