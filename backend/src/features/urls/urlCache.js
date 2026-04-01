const { redisTtlSeconds } = require("../../config");
const { redisEnabled } = require("../../cache/redisClient");

const CACHE_KEY_PREFIX = "short-url:";

/**
 * Namespaces cached URL rows so they do not collide with unrelated Redis data.
 *
 * @param {string} code
 * @returns {string}
 */
function getCacheKey(code) {
  return `${CACHE_KEY_PREFIX}${code}`;
}

/**
 * Attempts to resolve a short code from Redis.
 *
 * @param {import("redis").RedisClientType|null} redisClient
 * @param {string} code
 * @param {object} [logger]
 * @returns {Promise<{id: number, code: string, originalUrl: string, createdAt: string}|null>}
 */
async function getCachedUrl(redisClient, code, logger) {
  if (!redisClient || !redisEnabled()) {
    if (logger) {
      logger.warn("Redis read skipped because cache is unavailable", { code });
    }
    return null;
  }

  const key = getCacheKey(code);

  if (logger) {
    logger.step("Checking Redis cache", { code, key });
  }

  const cachedValue = await redisClient.get(key);

  if (!cachedValue) {
    if (logger) {
      logger.warn("Redis cache miss", { code, key });
    }
    return null;
  }

  if (logger) {
    logger.success("Redis cache hit", {
      code,
      key,
    });
  }

  return JSON.parse(cachedValue);
}

/**
 * Writes a URL row into Redis to avoid repeated database lookups.
 *
 * @param {import("redis").RedisClientType|null} redisClient
 * @param {{code: string} & Record<string, unknown>} url
 * @param {object} [logger]
 * @returns {Promise<void>}
 */
async function cacheUrl(redisClient, url, logger) {
  if (!redisClient || !redisEnabled() || !url) {
    if (logger) {
      logger.warn("Redis cache write skipped", {
        cacheAvailable: Boolean(redisClient && redisEnabled()),
        url,
      });
    }
    return;
  }

  const key = getCacheKey(url.code);
  const value = JSON.stringify(url);

  if (logger) {
    logger.step("Writing value to Redis", {
      key,
      ttlSeconds: redisTtlSeconds,
    });
  }

  await redisClient.set(key, value, {
    EX: redisTtlSeconds,
  });

  if (logger) {
    logger.success("Redis cache write completed", {
      key,
      ttlSeconds: redisTtlSeconds,
    });
  }
}

module.exports = {
  getCachedUrl,
  cacheUrl,
};
