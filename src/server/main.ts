import "./instrument.js";
import * as Sentry from "@sentry/node";
import { getLetterboxdFetchTimeoutMs } from "./lib/letterboxdFetchTimeout.js";
import { memoryCache } from "./lib/memoryCache.js";
import { createServer } from "./createServer.js";

const port = Number(process.env.PORT ?? 3000);

async function main() {
  const { port: actualPort, close } = await (await createServer()).start(port);

  console.log(`Letterboxd outbound fetch timeout: ${getLetterboxdFetchTimeoutMs()} ms`);
  console.log(`fastify app listening on port http://localhost:${actualPort}`);
  memoryCache.startCleanup();

  const gracefulShutdown = async () => {
    try {
      if (Sentry.getClient()) {
        await Sentry.close(2000);
      }
      await close();
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

try {
  await main();
} catch (err) {
  console.error("Failed to start fastify server:", err);
  if (Sentry.getClient()) {
    Sentry.captureException(err);
    await Sentry.close(2000);
  }
  process.exit(1);
}
