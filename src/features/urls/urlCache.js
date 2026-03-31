const { redisTtlSeconds } = require("../../config");
const { redisEnabled } = require("../../cache/redisClient");

const CACHE_KEY_PREFIX = "short-url:";

function getCacheKey(code) {
  return `${CACHE_KEY_PREFIX}${code}`;
}

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
