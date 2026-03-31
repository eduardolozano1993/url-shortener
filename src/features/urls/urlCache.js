const { redisTtlSeconds } = require("../../config");
const { redisEnabled } = require("../../cache/redisClient");

const CACHE_KEY_PREFIX = "short-url:";

function getCacheKey(code) {
  return `${CACHE_KEY_PREFIX}${code}`;
}

async function getCachedUrl(redisClient, code) {
  if (!redisClient || !redisEnabled()) {
    return null;
  }

  const cachedValue = await redisClient.get(getCacheKey(code));

  if (!cachedValue) {
    console.log(`Cache miss for code: ${code}`);
    return null;
  }

  console.log(`Cached value for code ${code}:`, cachedValue);

  return JSON.parse(cachedValue);
}

async function cacheUrl(redisClient, url) {
  if (!redisClient || !redisEnabled() || !url) {
    return;
  }

  await redisClient.set(getCacheKey(url.code), JSON.stringify(url), {
    EX: redisTtlSeconds,
  });
}

module.exports = {
  getCachedUrl,
  cacheUrl,
};
