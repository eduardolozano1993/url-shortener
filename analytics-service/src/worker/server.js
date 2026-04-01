const { closePool } = require("../infrastructure/database/pool");
const { closeRabbitMq } = require("../infrastructure/messaging/rabbitMq");
const { createFlowLogger } = require("../infrastructure/logging/logger");
const { startConsumer } = require("../modules/analytics/consumer");

/**
 * Starts the analytics background worker.
 *
 * @param {object} logger
 * @returns {Promise<{stop: () => Promise<void>}>}
 */
async function startWorker(logger) {
  await startConsumer(logger.child("CONSUMER"));

  return {
    async stop() {
      await closeRabbitMq();
      await closePool();
    },
  };
}

module.exports = {
  startWorker,
};

if (require.main === module) {
  const logger = createFlowLogger("ANALYTICS_WORKER");

  startWorker(logger)
    .then((runtime) => {
      const shutdown = async (signal) => {
        logger.warn("Stopping analytics worker", { signal });
        await runtime.stop();
        process.exit(0);
      };

      process.on("SIGINT", () => {
        shutdown("SIGINT").catch((error) => {
          logger.error("Shutdown error", { message: error.message });
          process.exit(1);
        });
      });

      process.on("SIGTERM", () => {
        shutdown("SIGTERM").catch((error) => {
          logger.error("Shutdown error", { message: error.message });
          process.exit(1);
        });
      });
    })
    .catch((error) => {
      logger.error("Failed to start analytics worker", { message: error.message });
      process.exit(1);
    });
}
