import type { HttpHandlerArgs, HttpResponseContext } from "@server/httpContext.js";
import { vi } from "vitest";

export type MockRes = HttpResponseContext & {
  jsonMock: (payload: unknown) => void;
  statusCode: number | undefined;
};

export function createMockRes(): MockRes {
  const jsonMock = vi.fn();
  const self: MockRes = {
    json: jsonMock,
    jsonMock,
    statusCode: undefined,
    status(code: number) {
      self.statusCode = code;
      return self;
    },
    send() {},
    setHeader() {
      return self;
    },
  };
  return self;
}

export type ControllerTestArgs = Omit<HttpHandlerArgs, "res"> & { res: MockRes };

export function createControllerArgs(body: unknown, url: string): ControllerTestArgs {
  return {
    req: {
      body,
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url,
      cookies: {},
      session: {},
      appLocals: {},
    },
    res: createMockRes(),
  };
}
