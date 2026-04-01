const app = require("./app");
const { port } = require("./config");
const { closePool } = require("./db/pool");
const { createFlowLogger } = require("./logging/logger");
const { closeRabbitMq } = require("./queue/rabbitMq");
const { startConsumer } = require("./analytics/consumer");

const logger = createFlowLogger("ANALYTICS_SERVICE");

const server = app.listen(port, () => {
  logger.success("Analytics service listening", { port });
});

startConsumer(logger.child("CONSUMER")).catch((error) => {
  logger.error("Failed to start analytics consumer", { message: error.message });
  process.exit(1);
});

async function shutdown(signal) {
  logger.warn("Stopping analytics service", { signal });
  server.close(async () => {
    await closeRabbitMq();
    await closePool();
    process.exit(0);
  });
}

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
