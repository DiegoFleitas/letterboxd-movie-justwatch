export interface HttpRequestContext {
  body: unknown;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  method: string;
  url: string;
  cookies: Record<string, unknown>;
  session: unknown;
  appLocals: {
    canonicalProviderMap?: unknown;
    // Allow attaching any other locals as needed in future.
    [key: string]: unknown;
  };
}

export interface HttpResponseContext {
  status(code: number): HttpResponseContext;
  json(payload: unknown): void;
  send(payload?: unknown): void;
  setHeader(name: string, value: string | number | readonly string[]): HttpResponseContext;
}

export interface HttpHandlerArgs {
  req: HttpRequestContext;
  res: HttpResponseContext;
}

export type HttpHandler = (ctx: HttpHandlerArgs) => Promise<void> | void;
