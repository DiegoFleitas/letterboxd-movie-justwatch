# syntax = docker/dockerfile:1

ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS base
ARG SENTRY_RELEASE=""

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV="production"
ENV SENTRY_RELEASE="${SENTRY_RELEASE}"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Packages needed to build native node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Reuse prebuilt frontend artifacts when present (CI sourcemap flow),
# otherwise build them inside the image for local/manual deploys.
RUN if [ ! -d public/dist ]; then bun run build; fi

# Production node_modules only
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# Final stage for app image
FROM base

COPY --from=build /app /app

EXPOSE 3000
CMD ["bun", "run", "start"]
