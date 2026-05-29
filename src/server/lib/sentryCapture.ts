import * as Sentry from "@sentry/node";

export type ServerSentryContext = {
  route: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
};

export function captureServerException(error: unknown, context: ServerSentryContext): string {
  if (!Sentry.getClient()) return "";
  return Sentry.captureException(error, {
    tags: { route: context.route, ...context.tags },
    extra: context.extra,
  });
}
