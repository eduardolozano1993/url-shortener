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

function redisEnabled() {
  return isAvailable;
}

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
