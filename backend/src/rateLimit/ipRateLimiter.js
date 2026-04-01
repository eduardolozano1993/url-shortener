const { connectRedis } = require("../cache/redisClient");
const { createFlowLogger } = require("../logging/logger");
const { recordRateLimitDecision } = require("../monitoring/metrics");

const RATE_LIMIT = 100;
const WINDOW_SECONDS = 60 * 60;
const KEY_PREFIX = "rate_limit:ip";
const EXCLUDED_PATHS = new Set(["/health", "/metrics"]);
const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

function getCurrentWindowStart(now = new Date()) {
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    0,
    0,
    0,
  );
}

function getCurrentWindowKey(ipAddress, now = new Date()) {
  return `${KEY_PREFIX}:${ipAddress}:hour:${new Date(getCurrentWindowStart(now)).toISOString()}`;
}

function getSecondsUntilNextWindow(now = new Date()) {
  const currentWindowStart = getCurrentWindowStart(now);
  const nextWindowStart = currentWindowStart + WINDOW_SECONDS * 1000;
  return Math.max(1, Math.ceil((nextWindowStart - now.getTime()) / 1000));
}

function shouldSkipRateLimit(req) {
  return EXCLUDED_PATHS.has(req.path);
}

async function incrementRequestCount(redisClient, key, ttlSeconds) {
  return redisClient.eval(INCREMENT_SCRIPT, {
    keys: [key],
    arguments: [String(ttlSeconds)],
  });
}

function setRateLimitHeaders(res, remaining, resetSeconds) {
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  res.setHeader("X-RateLimit-Reset", String(resetSeconds));
}

function createIpRateLimiter(options = {}) {
  const getNow = options.getNow || (() => new Date());
  const redisConnector = options.connectRedis || connectRedis;

  return async function ipRateLimiter(req, res, next) {
    if (shouldSkipRateLimit(req)) {
      return next();
    }

    const logger = createFlowLogger("RATE_LIMIT");
    const now = getNow();
    const ipAddress = req.ip || req.socket?.remoteAddress || "unknown";
    const resetSeconds = getSecondsUntilNextWindow(now);
    const rateLimitKey = getCurrentWindowKey(ipAddress, now);

    try {
      const redisClient = await redisConnector();
      const currentCount = Number(
        await incrementRequestCount(redisClient, rateLimitKey, resetSeconds + 60),
      );
      const remaining = RATE_LIMIT - currentCount;

      setRateLimitHeaders(res, remaining, resetSeconds);

      if (currentCount > RATE_LIMIT) {
        recordRateLimitDecision("blocked");
        logger.warn("IP rate limit exceeded", {
          currentCount,
          ipAddress,
          path: req.originalUrl,
          resetSeconds,
        });
        res.setHeader("Retry-After", String(resetSeconds));
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      recordRateLimitDecision("allowed");
      return next();
    } catch (error) {
      recordRateLimitDecision("failed_open");
      logger.warn("IP rate limiter unavailable, allowing request", {
        error: error.message,
        ipAddress,
        path: req.originalUrl,
      });
      return next();
    }
  };
}

module.exports = {
  RATE_LIMIT,
  WINDOW_SECONDS,
  createIpRateLimiter,
  getCurrentWindowKey,
  getCurrentWindowStart,
  getSecondsUntilNextWindow,
  shouldSkipRateLimit,
};
