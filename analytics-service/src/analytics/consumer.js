const {
  analyticsClickedQueue,
  analyticsFailedQueue,
  analyticsMaxRetries,
  analyticsRetryQueue,
} = require("../config");
const { getChannel } = require("../queue/rabbitMq");
const { recordClick } = require("./repository");

function parseMessage(message) {
  return JSON.parse(message.content.toString("utf8"));
}

function getRetryCount(message) {
  return Number(message.properties.headers?.["x-retry-count"] || 0);
}

async function routeForRetry(channel, message, event, error, logger) {
  const retryCount = getRetryCount(message);

  if (retryCount >= analyticsMaxRetries) {
    channel.sendToQueue(analyticsFailedQueue, message.content, {
      contentType: "application/json",
      deliveryMode: 2,
      headers: {
        ...message.properties.headers,
        "x-error-message": error.message,
        "x-final-failure-at": new Date().toISOString(),
      },
      messageId: message.properties.messageId,
      timestamp: Date.now(),
      type: message.properties.type,
    });
    channel.ack(message);
    logger.error("Analytics event moved to failed queue", {
      eventId: event?.eventId,
      retries: retryCount,
      urlCode: event?.urlCode,
    });
    return;
  }

  channel.sendToQueue(analyticsRetryQueue, message.content, {
    contentType: "application/json",
    deliveryMode: 2,
    headers: {
      ...message.properties.headers,
      "x-retry-count": retryCount + 1,
      "x-last-error-message": error.message,
    },
    messageId: message.properties.messageId,
    timestamp: Date.now(),
    type: message.properties.type,
  });
  channel.ack(message);
  logger.warn("Analytics event scheduled for retry", {
    eventId: event?.eventId,
    retries: retryCount + 1,
    urlCode: event?.urlCode,
  });
}

async function startConsumer(logger) {
  const channel = await getChannel();
  await channel.prefetch(10);

  logger.start("Analytics consumer started", {
    queue: analyticsClickedQueue,
    retryQueue: analyticsRetryQueue,
    failedQueue: analyticsFailedQueue,
  });

  await channel.consume(analyticsClickedQueue, async (message) => {
    if (!message) {
      return;
    }

    let event = null;

    try {
      event = parseMessage(message);
      logger.step("Processing analytics event", {
        eventId: event.eventId,
        urlCode: event.urlCode,
      });
      await recordClick(event, logger.child("CLICK"));
      channel.ack(message);
    } catch (error) {
      logger.error("Analytics consumer failed to process event", {
        eventId: event?.eventId,
        message: error.message,
        urlCode: event?.urlCode,
      });
      await routeForRetry(channel, message, event, error, logger);
    }
  });
}

module.exports = {
  startConsumer,
};
