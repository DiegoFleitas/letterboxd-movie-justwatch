import { isAxiosError } from "axios";

export type JustWatchHttpErrorSnapshot = {
  total: number;
  byStatus: Record<string, number>;
  last?: { status: number; at: string };
};

const justWatchHttpErrorCounts = new Map<number, number>();
let justWatchHttpErrorTotal = 0;
let justWatchHttpErrorLast: { status: number; at: string } | undefined;

function normalizeJustWatchAttemptStatus(err: unknown): number {
  if (!isAxiosError(err)) return 0;
  const status = err.response?.status;
  if (typeof status === "number" && Number.isFinite(status)) return status;
  return 0;
}

/**
 * Count non-success HTTP attempts for JustWatch GraphQL calls (includes retry attempts).
 * Status `0` means "no HTTP response" (timeouts/DNS/etc).
 */
export function recordJustWatchHttpAttempt(err: unknown): void {
  const status = normalizeJustWatchAttemptStatus(err);
  if (status >= 200 && status <= 299) return;

  justWatchHttpErrorTotal += 1;
  justWatchHttpErrorCounts.set(status, (justWatchHttpErrorCounts.get(status) ?? 0) + 1);
  justWatchHttpErrorLast = { status, at: new Date().toISOString() };
}

export function getJustWatchHttpErrorSnapshot(): JustWatchHttpErrorSnapshot {
  const byStatus: Record<string, number> = {};
  for (const [status, count] of justWatchHttpErrorCounts.entries()) {
    byStatus[String(status)] = count;
  }
  return { total: justWatchHttpErrorTotal, byStatus, last: justWatchHttpErrorLast };
}
