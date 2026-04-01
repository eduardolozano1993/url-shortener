const crypto = require("crypto");
const db = require("../../db/query");
const { cacheUrl, getCachedUrl } = require("./urlCache");
const { summarizeUrl } = require("./urlSecurity");

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Converts random bytes into the base62 alphabet used for short codes.
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function toBase62(buffer) {
  let num = BigInt(`0x${buffer.toString("hex")}`);
  let result = "";

  while (num > 0n) {
    const remainder = num % 62n;
    result = BASE62_ALPHABET[Number(remainder)] + result;
    num /= 62n;
  }

  return result || "0";
}

/**
 * Generates the preferred deterministic code for a URL so repeated shorten
 * requests usually resolve to the same value.
 *
 * @param {string} originalUrl
 * @returns {string}
 */
function generateHashCode(originalUrl) {
  const hash = crypto.createHash("sha256").update(originalUrl).digest();
  return toBase62(hash.subarray(0, 6));
}

/**
 * Generates an alternate code for the rare case where the deterministic code
 * collides with a different URL.
 *
 * @returns {string}
 */
function generateRandomCode() {
  return toBase62(crypto.randomBytes(6));
}

/**
 * Persists a new short URL, falling back from deterministic hashing to random
 * codes when necessary.
 *
 * @param {string} originalUrl
 * @param {import("redis").RedisClientType|null} redisClient
 * @param {object} logger
 * @returns {Promise<{id: number, code: string, originalUrl: string, createdAt: string}>}
 */
async function createShortUrl(originalUrl, redisClient, logger) {
  const hashCode = generateHashCode(originalUrl);
  logger.step("Generated deterministic hash code", {
    code: hashCode,
    url: summarizeUrl(new URL(originalUrl)),
  });

  try {
    const result = await db.queryWrite(
      `
      INSERT INTO urls (code, original_url)
      VALUES ($1, $2)
      RETURNING id, code, original_url AS "originalUrl", created_at AS "createdAt"
      `,
      [hashCode, originalUrl],
      logger,
    );
    logger.success("Inserted new row into primary DB", result.rows[0]);
    await db.upsertReplicaUrl(result.rows[0], logger);
    await cacheUrl(redisClient, result.rows[0], logger);
    return result.rows[0];
  } catch (error) {
    if (error.code !== "23505") {
      logger.error("Primary DB write failed", {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    logger.warn("Primary DB reported code conflict", {
      code: hashCode,
      url: summarizeUrl(new URL(originalUrl)),
    });

    // First check whether the conflict is just the same URL being shortened again.
    const cachedUrl = await getCachedUrl(redisClient, hashCode, logger);

    if (cachedUrl && cachedUrl.originalUrl === originalUrl) {
      logger.success("Duplicate URL resolved from Redis cache", cachedUrl);
      return cachedUrl;
    }

    const existing = await db.queryWrite(
      `
      SELECT id, code, original_url AS "originalUrl", created_at AS "createdAt"
      FROM urls
      WHERE code = $1
      `,
      [hashCode],
      logger,
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      if (row.originalUrl === originalUrl) {
        logger.success("Duplicate URL resolved from primary DB", row);
        await db.upsertReplicaUrl(row, logger);
        await cacheUrl(redisClient, row, logger);
        return row;
      }
    }

    // If the hash belongs to some other URL, retry with random codes a few times.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const randomCode = generateRandomCode();
      logger.warn("Hash collision detected, trying random fallback", {
        attempt: attempt + 1,
        originalHashCode: hashCode,
        randomCode,
      });

      try {
        const result = await db.queryWrite(
          `
          INSERT INTO urls (code, original_url)
          VALUES ($1, $2)
          RETURNING id, code, original_url AS "originalUrl", created_at AS "createdAt"
          `,
          [randomCode, originalUrl],
          logger,
        );

        logger.success("Inserted fallback row into primary DB", result.rows[0]);
        await db.upsertReplicaUrl(result.rows[0], logger);
        await cacheUrl(redisClient, result.rows[0], logger);
        return result.rows[0];
      } catch (err) {
        if (err.code !== "23505" || attempt === 4) {
          logger.error("Random fallback insert failed", {
            attempt: attempt + 1,
            code: err.code,
            message: err.message,
          });
          throw err;
        }
      }
    }
  }

  throw new Error("Unable to generate a unique short code");
}

/**
 * Resolves a short code, preferring cache and falling back to the replica.
 *
 * @param {string} code
 * @param {import("redis").RedisClientType|null} redisClient
 * @param {object} logger
 * @returns {Promise<{id: number, code: string, originalUrl: string, createdAt: string}|null>}
 */
async function getUrlByCode(code, redisClient, logger) {
  const cachedUrl = await getCachedUrl(redisClient, code, logger);

  if (cachedUrl) {
    logger.success("Returning URL from Redis cache", cachedUrl);
    return cachedUrl;
  }

  const result = await db.queryRead(
    'SELECT id, code, original_url AS "originalUrl", created_at AS "createdAt" FROM urls WHERE code = $1',
    [code],
    logger,
  );
  const url = result.rows[0] || null;

  if (!url) {
    logger.warn("Replica DB returned no row for code", { code });
    return null;
  }

  logger.success("Read URL from replica DB", url);
  await cacheUrl(redisClient, url, logger);

  return url;
}

module.exports = {
  createShortUrl,
  getUrlByCode,
};
