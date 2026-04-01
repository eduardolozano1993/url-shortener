const { replicaSyncDelayMs } = require("../../config");
const { primaryPool, replicaPool } = require("./pool");

/**
 * Emits a compact SQL trace into the structured flow logger.
 *
 * @param {object | undefined} logger
 * @param {string} target
 * @param {string} text
 * @param {unknown[] | undefined} params
 * @returns {void}
 */
function logQuery(logger, target, text, params) {
  if (!logger) {
    return;
  }

  logger.step(`Querying ${target}`, {
    parameterCount: Array.isArray(params) ? params.length : 0,
    sql: text.replace(/\s+/g, " ").trim(),
  });
}

/**
 * Executes a write against the primary database.
 *
 * @param {string} text
 * @param {unknown[]} params
 * @param {object} logger
 * @returns {Promise<import("pg").QueryResult>}
 */
async function queryWrite(text, params, logger) {
  logQuery(logger, "primary DB", text, params);
  return primaryPool.query(text, params);
}

/**
 * Executes a read against the replica database.
 *
 * @param {string} text
 * @param {unknown[]} params
 * @param {object} logger
 * @returns {Promise<import("pg").QueryResult>}
 */
async function queryRead(text, params, logger) {
  logQuery(logger, "replica DB", text, params);
  return replicaPool.query(text, params);
}

/**
 * Wraps multiple statements in a primary-database transaction.
 *
 * @template T
 * @param {(client: import("pg").PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withPrimaryTransaction(callback) {
  const client = await primaryPool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Mirrors a URL row into the replica. When a sync delay is configured, the
 * write is intentionally deferred to simulate eventual consistency.
 *
 * @param {{id: number, code: string, originalUrl: string, createdAt: string}|null} url
 * @param {object} [logger]
 * @returns {Promise<void>}
 */
async function upsertReplicaUrl(url, logger) {
  if (!url) {
    return;
  }

  const sync = async () => {
    if (logger) {
      logger.step("Syncing row to replica", url);
    }

    await replicaPool.query(
      `
      INSERT INTO urls (id, code, original_url, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE
      SET original_url = EXCLUDED.original_url,
          created_at = EXCLUDED.created_at
      `,
      [url.id, url.code, url.originalUrl, url.createdAt],
    );

    if (logger) {
      logger.success("Replica sync completed", {
        code: url.code,
        replicaSyncDelayMs,
      });
    }
  };

  if (replicaSyncDelayMs > 0) {
    if (logger) {
      logger.warn("Replica sync scheduled with delay", {
        code: url.code,
        replicaSyncDelayMs,
      });
    }

    // The timeout is fire-and-forget on purpose so the API request can return immediately.
    setTimeout(() => {
      sync().catch((error) => {
        if (logger) {
          logger.error("Replica sync failed", { error: error.message });
        } else {
          console.error("Replica sync failed:", error.message);
        }
      });
    }, replicaSyncDelayMs);
    return;
  }

  await sync();
}

module.exports = {
  queryWrite,
  queryRead,
  withPrimaryTransaction,
  upsertReplicaUrl,
};
