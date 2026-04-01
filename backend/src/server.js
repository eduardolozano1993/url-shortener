const app = require("./app");
const { port } = require("./config");
const { disconnectRedis } = require("./cache/redisClient");
const { closeAnalyticsPublisher } = require("./queue/analyticsPublisher");
const { closeRabbitMq } = require("./queue/rabbitMq");
const { closeAllPools } = require("./db/pool");

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

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
