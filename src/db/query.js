const { replicaSyncDelayMs } = require("../config");
const { primaryPool, replicaPool } = require("./pool");

function logQuery(logger, target, text, params) {
  if (!logger) {
    return;
  }

  logger.step(`Querying ${target}`, {
    params,
    sql: text.replace(/\s+/g, " ").trim(),
  });
}

async function queryWrite(text, params, logger) {
  logQuery(logger, "primary DB", text, params);
  return primaryPool.query(text, params);
}

async function queryRead(text, params, logger) {
  logQuery(logger, "replica DB", text, params);
  return replicaPool.query(text, params);
}

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
