const { replicaSyncDelayMs } = require("../config");
const { primaryPool, replicaPool } = require("./pool");

async function queryWrite(text, params) {
  return primaryPool.query(text, params);
}

async function queryRead(text, params) {
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

async function upsertReplicaUrl(url) {
  if (!url) {
    return;
  }

  const sync = async () => {
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
  };

  if (replicaSyncDelayMs > 0) {
    setTimeout(() => {
      sync().catch((error) => {
        console.error("Replica sync failed:", error.message);
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
