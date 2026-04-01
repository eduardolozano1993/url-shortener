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
} = require("../config");

let connectionPromise = null;
let channelPromise = null;

function buildConnectionUrl() {
  if (rabbitMqUrl) {
    return rabbitMqUrl;
  }

  const normalizedVhost = rabbitMqVhost.startsWith("/")
    ? rabbitMqVhost
    : `/${rabbitMqVhost}`;

  return `amqp://${encodeURIComponent(rabbitMqUser)}:${encodeURIComponent(rabbitMqPassword)}@${rabbitMqHost}:${rabbitMqPort}${normalizedVhost}`;
}

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

async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = createConnection();
  }

  return connectionPromise;
}

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
