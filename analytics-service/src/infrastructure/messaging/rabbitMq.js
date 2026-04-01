const amqp = require("amqplib");
const {
  analyticsClickedQueue,
  analyticsClickedRoutingKey,
  analyticsExchange,
  analyticsFailedQueue,
  analyticsRetryDelayMs,
  analyticsRetryQueue,
  rabbitMqHost,
  rabbitMqPassword,
  rabbitMqPort,
  rabbitMqUrl,
  rabbitMqUser,
  rabbitMqVhost,
} = require("../../config");

let connectionPromise = null;
let channelPromise = null;

/**
 * Builds the connection URL used by the analytics consumer.
 *
 * @returns {string}
 */
function buildConnectionUrl() {
  if (rabbitMqUrl) {
    return rabbitMqUrl;
  }

  const normalizedVhost = rabbitMqVhost.startsWith("/")
    ? rabbitMqVhost
    : `/${rabbitMqVhost}`;

  return `amqp://${encodeURIComponent(rabbitMqUser)}:${encodeURIComponent(rabbitMqPassword)}@${rabbitMqHost}:${rabbitMqPort}${normalizedVhost}`;
}

/**
 * Opens the shared RabbitMQ connection and resets cached state if it drops.
 *
 * @returns {Promise<import("amqplib").Connection>}
 */
async function createConnection() {
  const connection = await amqp.connect(buildConnectionUrl());
  connection.on("error", () => {
    connectionPromise = null;
    channelPromise = null;
  });
  connection.on("close", () => {
    connectionPromise = null;
    channelPromise = null;
  });
  return connection;
}

/**
 * @returns {Promise<import("amqplib").Connection>}
 */
async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = createConnection();
  }

  return connectionPromise;
}

/**
 * Declares the exchange and queues consumed by the analytics worker.
 *
 * @param {import("amqplib").Channel} channel
 * @returns {Promise<void>}
 */
async function configureTopology(channel) {
  await channel.assertExchange(analyticsExchange, "topic", { durable: true });
  await channel.assertQueue(analyticsClickedQueue, { durable: true });
  await channel.bindQueue(analyticsClickedQueue, analyticsExchange, analyticsClickedRoutingKey);

  await channel.assertQueue(analyticsRetryQueue, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": analyticsExchange,
      "x-dead-letter-routing-key": analyticsClickedRoutingKey,
      "x-message-ttl": analyticsRetryDelayMs,
    },
  });

  await channel.assertQueue(analyticsFailedQueue, { durable: true });
}

/**
 * Returns the shared channel after ensuring topology is ready.
 *
 * @returns {Promise<import("amqplib").Channel>}
 */
async function getChannel() {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await getConnection();
      const channel = await connection.createChannel();
      channel.on("error", () => {
        channelPromise = null;
      });
      channel.on("close", () => {
        channelPromise = null;
      });
      await configureTopology(channel);
      return channel;
    })();
  }

  return channelPromise;
}

/**
 * Closes the connection and clears cached promises for shutdown or restart.
 *
 * @returns {Promise<void>}
 */
async function closeRabbitMq() {
  if (!connectionPromise) {
    return;
  }

  try {
    const connection = await connectionPromise;
    await connection.close();
  } catch (_error) {
    // Ignore shutdown errors.
  } finally {
    connectionPromise = null;
    channelPromise = null;
  }
}

module.exports = {
  getChannel,
  closeRabbitMq,
};
