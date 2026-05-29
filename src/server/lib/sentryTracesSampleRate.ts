/** Default trace sampling in production when SENTRY_TRACES_SAMPLE_RATE is unset. */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

export function resolveTracesSampleRate(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): number {
  const trimmed = raw?.trim();
  if (trimmed) {
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) return Math.min(Math.max(parsed, 0), 1);
  }
  return (nodeEnv ?? "development") === "production" ? PRODUCTION_TRACES_SAMPLE_RATE : 0;
}
