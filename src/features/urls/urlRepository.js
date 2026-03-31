const crypto = require("crypto");
const db = require("../../db/query");
const { cacheUrl, getCachedUrl } = require("./urlCache");

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function generateHashCode(originalUrl) {
  const hash = crypto.createHash("sha256").update(originalUrl).digest();
  return toBase62(hash.subarray(0, 6));
}

function generateRandomCode() {
  return toBase62(crypto.randomBytes(6));
}

async function createShortUrl(originalUrl, redisClient) {
  const hashCode = generateHashCode(originalUrl);

  try {
    const result = await db.queryWrite(
      `
      INSERT INTO urls (code, original_url)
      VALUES ($1, $2)
      RETURNING id, code, original_url AS "originalUrl", created_at AS "createdAt"
      `,
      [hashCode, originalUrl],
    );
    console.log("URL shortened using hash code:", hashCode);
    await db.upsertReplicaUrl(result.rows[0]);
    await cacheUrl(redisClient, result.rows[0]);
    return result.rows[0];
  } catch (error) {
    if (error.code !== "23505") {
      throw error;
    }

    const cachedUrl = await getCachedUrl(redisClient, hashCode);

    if (cachedUrl && cachedUrl.originalUrl === originalUrl) {
      console.log("Deduplication hit from cache for URL:", originalUrl);
      return cachedUrl;
    }

    const existing = await db.queryWrite(
      `
      SELECT id, code, original_url AS "originalUrl", created_at AS "createdAt"
      FROM urls
      WHERE code = $1
      `,
      [hashCode],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      if (row.originalUrl === originalUrl) {
        console.log("Deduplication hit from DB for URL:", originalUrl);
        await db.upsertReplicaUrl(row);
        await cacheUrl(redisClient, row);
        return row;
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      console.log(
        `Collision detected for code "${hashCode}". Attempting random fallback (attempt ${attempt + 1})...`,
      );
      const randomCode = generateRandomCode();

      try {
        const result = await db.queryWrite(
          `
          INSERT INTO urls (code, original_url)
          VALUES ($1, $2)
          RETURNING id, code, original_url AS "originalUrl", created_at AS "createdAt"
          `,
          [randomCode, originalUrl],
        );

        await db.upsertReplicaUrl(result.rows[0]);
        await cacheUrl(redisClient, result.rows[0]);
        return result.rows[0];
      } catch (err) {
        if (err.code !== "23505" || attempt === 4) {
          throw err;
        }
      }
    }
  }

  throw new Error("Unable to generate a unique short code");
}

async function getUrlByCode(code, redisClient) {
  const cachedUrl = await getCachedUrl(redisClient, code);

  if (cachedUrl) {
    return cachedUrl;
  }

  console.log(`DB lookup for code: ${code}`);
  const result = await db.queryRead(
    'SELECT id, code, original_url AS "originalUrl", created_at AS "createdAt" FROM urls WHERE code = $1',
    [code],
  );
  const url = result.rows[0] || null;

  await cacheUrl(redisClient, url);

  return url;
}

module.exports = {
  createShortUrl,
  getUrlByCode,
};
