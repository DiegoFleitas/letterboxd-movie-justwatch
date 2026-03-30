# syntax = docker/dockerfile:1

ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Packages needed to build native node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# Production node_modules only
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# Final stage for app image
FROM base

COPY --from=build /app /app

EXPOSE 3000
CMD ["bun", "run", "start"]
