const crypto = require("node:crypto");
const {
  analyticsClickedRoutingKey,
  analyticsExchange,
  analyticsMaxRetries,
} = require("../../config");
const { getChannel } = require("./rabbitMq");

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Extracts the client IP from proxy headers first because the backend may sit
 * behind a load balancer.
 *
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractIpAddress(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

/**
 * Creates the analytics payload emitted after a successful redirect lookup.
 *
 * @param {import("express").Request} req
 * @param {{id: number, code: string, originalUrl: string}} url
 * @returns {{
 *   eventId: string,
 *   type: string,
 *   occurredAt: string,
 *   urlId: number,
 *   urlCode: string,
 *   originalUrl: string,
 *   referrer: string|null,
 *   userAgent: string|null,
 *   ipAddress: string|null
 * }}
 */
function buildUrlClickedEvent(req, url) {
  return {
    eventId: crypto.randomUUID(),
    type: "url.clicked",
    occurredAt: new Date().toISOString(),
    urlId: url.id,
    urlCode: url.code,
    originalUrl: url.originalUrl,
    referrer: req.get("referer") || null,
    userAgent: req.get("user-agent") || null,
    ipAddress: extractIpAddress(req),
  };
}

/**
 * Publishes a click event to RabbitMQ with simple retry/backoff. Failure is
 * tolerated because analytics should not block the redirect path.
 *
 * @param {import("express").Request} req
 * @param {{id: number, code: string, originalUrl: string}} url
 * @param {object} logger
 * @returns {Promise<object|null>}
 */
async function publishUrlClicked(req, url, logger) {
  const event = buildUrlClickedEvent(req, url);

  for (let attempt = 1; attempt <= analyticsMaxRetries; attempt += 1) {
    try {
      const channel = await getChannel();
      channel.publish(
        analyticsExchange,
        analyticsClickedRoutingKey,
        Buffer.from(JSON.stringify(event)),
        {
          contentType: "application/json",
          deliveryMode: 2,
          messageId: event.eventId,
          timestamp: Date.now(),
          type: event.type,
        },
      );

      logger.success("Published url.clicked event", {
        attempt,
        eventId: event.eventId,
        routingKey: analyticsClickedRoutingKey,
        urlCode: url.code,
      });
      return event;
    } catch (error) {
      logger.error("Failed to publish url.clicked event", {
        attempt,
        eventId: event.eventId,
        message: error.message,
        urlCode: url.code,
      });

      if (attempt === analyticsMaxRetries) {
        return null;
      }

      await sleep(250 * attempt);
    }
  }

  return null;
}

async function closeAnalyticsPublisher() {}

module.exports = {
  publishUrlClicked,
  closeAnalyticsPublisher,
};
