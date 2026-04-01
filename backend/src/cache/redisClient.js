const { createClient } = require("redis");
const {
  redisUrl,
  redisHost,
  redisPort,
  redisPassword,
} = require("../config");

let client;
let connectPromise;
let isAvailable = false;

/**
 * Builds the Redis client configuration from either a single connection URL or
 * the individual host/port/password settings.
 *
 * @returns {import("redis").RedisClientOptions}
 */
function getClientConfig() {
  if (redisUrl) {
    return {
      url: redisUrl,
      password: redisPassword,
    };
  }

  return {
    socket: {
      host: redisHost,
      port: redisPort,
    },
    password: redisPassword,
  };
}

/**
 * Lazily creates the singleton Redis client and keeps a small amount of
 * readiness state so callers can fail open when Redis is down.
 *
 * @returns {import("redis").RedisClientType}
 */
function getClient() {
  if (!client) {
    client = createClient(getClientConfig());

    client.on("ready", () => {
      isAvailable = true;
      console.log("Redis client is ready");
    });

    client.on("error", (error) => {
      isAvailable = false;
      console.error("Redis client error:", error.message);
    });

    client.on("end", () => {
      isAvailable = false;
      console.log("Redis client disconnected");
    });
  }

  return client;
}

/**
 * Opens the shared Redis client once and lets concurrent callers await the same
 * connection attempt.
 *
 * @returns {Promise<import("redis").RedisClientType>}
 */
async function connectRedis() {
  const redisClient = getClient();

  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient.connect().catch((error) => {
      isAvailable = false;
      connectPromise = null;
      throw error;
    });
  }

  await connectPromise;
  return redisClient;
}

/**
 * Indicates whether Redis is currently healthy enough for cache operations.
 *
 * @returns {boolean}
 */
function redisEnabled() {
  return isAvailable;
}

/**
 * Gracefully closes the shared Redis connection during shutdown.
 *
 * @returns {Promise<void>}
 */
async function disconnectRedis() {
  if (client && client.isOpen) {
    await client.quit();
  }
}

module.exports = {
  connectRedis,
  disconnectRedis,
  redisEnabled,
};
