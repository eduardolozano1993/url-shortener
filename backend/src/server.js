const app = require("./bootstrap/app");
const { port } = require("./config");
const { disconnectRedis } = require("./infrastructure/cache/redisClient");
const {
  closeAnalyticsPublisher,
} = require("./infrastructure/messaging/analyticsPublisher");
const { closeRabbitMq } = require("./infrastructure/messaging/rabbitMq");
const { closeAllPools } = require("./infrastructure/database/pool");

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

/**
 * Shuts the backend down in dependency order so no new requests arrive while
 * external connections are being torn down.
 *
 * @param {string} signal
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => {
    await disconnectRedis();
    await closeAnalyticsPublisher();
    await closeRabbitMq();
    await closeAllPools();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("Shutdown error:", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("Shutdown error:", error);
    process.exit(1);
  });
});
