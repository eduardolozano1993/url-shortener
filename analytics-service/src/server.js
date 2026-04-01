const { createFlowLogger } = require("./infrastructure/logging/logger");
const { startApiServer } = require("./api/server");
const { startWorker } = require("./worker/server");

const logger = createFlowLogger("ANALYTICS_SERVICE");
const runtime = {
  api: null,
  worker: null,
};

/**
 * Stops the HTTP server and the background consumer dependencies in a safe order.
 *
 * @param {string} signal
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  logger.warn("Stopping analytics service", { signal });
  await Promise.allSettled([
    runtime.api?.stop?.(),
    runtime.worker?.stop?.(),
  ]);
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error("Shutdown error", { message: error.message });
    process.exit(1);
  });
});

(async () => {
  runtime.api = await startApiServer(logger.child("API"));
  runtime.worker = await startWorker(logger.child("WORKER"));
})().catch((error) => {
  logger.error("Failed to start analytics service", { message: error.message });
  process.exit(1);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error("Shutdown error", { message: error.message });
    process.exit(1);
  });
});
