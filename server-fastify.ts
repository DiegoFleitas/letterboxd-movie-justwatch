import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { createServer } from "./server/createServer.js";

const port = Number(process.env.PORT ?? 3000);

async function main() {
  const { port: actualPort, close } = await createServer({
    framework: "fastify",
  }).start(port);

  console.log(`fastify app listening on port http://localhost:${actualPort}`);

  const gracefulShutdown = async () => {
    try {
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

main().catch((err) => {
  console.error("Failed to start fastify server:", err);
  process.exit(1);
});
