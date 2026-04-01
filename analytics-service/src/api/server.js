const app = require("./app");
const { port } = require("../config");
const { closePool } = require("../infrastructure/database/pool");
const { createFlowLogger } = require("../infrastructure/logging/logger");

/**
 * Starts the analytics HTTP API.
 *
 * @param {object} logger
 * @returns {Promise<{stop: () => Promise<void>}>}
 */
async function startApiServer(logger) {
  const server = app.listen(port, () => {
    logger.success("Analytics API listening", { port });
  });

  return {
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

module.exports = {
  startApiServer,
};

if (require.main === module) {
  const logger = createFlowLogger("ANALYTICS_API");

  startApiServer(logger)
    .then((runtime) => {
      const shutdown = async (signal) => {
        logger.warn("Stopping analytics API", { signal });
        await runtime.stop();
        await closePool();
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
      logger.error("Failed to start analytics API", { message: error.message });
      process.exit(1);
    });
}
