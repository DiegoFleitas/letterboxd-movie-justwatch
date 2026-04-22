const JSON_MIME_TYPE = "application/json";
const BODY_SNIPPET_MAX_CHARS = 200;

export type SafeJsonErrorKind = "non-json-content-type" | "empty-body" | "invalid-json";

export class SafeJsonResponseError extends Error {
  readonly kind: SafeJsonErrorKind;
  readonly status: number;
  readonly bodySnippet: string;

  constructor(kind: SafeJsonErrorKind, status: number, bodySnippet: string) {
    super(`Unable to parse response JSON (${kind})`);
    this.name = "SafeJsonResponseError";
    this.kind = kind;
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export async function safeJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();
  const bodySnippet = rawBody.slice(0, BODY_SNIPPET_MAX_CHARS);

  if (!contentType.toLowerCase().includes(JSON_MIME_TYPE)) {
    throw new SafeJsonResponseError("non-json-content-type", response.status, bodySnippet);
  }

  if (!rawBody.trim()) {
    throw new SafeJsonResponseError("empty-body", response.status, bodySnippet);
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new SafeJsonResponseError("invalid-json", response.status, bodySnippet);
  }
}
