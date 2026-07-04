import { createApp } from "./app.js";
import { env, assertProductionEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";

assertProductionEnv();

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info("server.started", { port: env.port, env: env.nodeEnv, model: env.anthropicModel });
});

function shutdown(signal: string) {
  logger.info("server.shutdown", { signal });
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
