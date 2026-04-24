import type { HttpRequestContext, HttpResponseContext } from "@server/httpContext.js";

export function createHttpMockResponse() {
  let statusCode = 0;
  let jsonBody: unknown;

  const res: HttpResponseContext = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
    },
    send() {},
    setHeader() {
      return this;
    },
  };

  return {
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
}

type RequestBody = Record<string, unknown>;

export function createLetterboxdRequest(
  body: RequestBody,
  url: string,
  session: HttpRequestContext["session"] = null,
): HttpRequestContext {
  return {
    body,
    params: {},
    query: {},
    headers: {},
    method: "POST",
    url,
    cookies: {},
    session,
    appLocals: {},
  };
}
