const fs = require("fs/promises");
const path = require("path");
const { primaryPool, replicaPool } = require("./pool");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(pool) {
  const result = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function runForPool(pool, label) {
  const migrationsDir = path.join(__dirname, "migrations");
  const filenames = (await fs.readdir(migrationsDir)).sort();

  await ensureMigrationsTable(pool);
  const executed = await getExecutedMigrations(pool);

  for (const filename of filenames) {
    if (executed.has(filename)) {
      continue;
    }

    const filePath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(filePath, "utf8");

    await pool.query("BEGIN");

    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await pool.query("COMMIT");
      console.log(`[${label}] Applied migration: ${filename}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  console.log(`[${label}] Migrations complete`);
}

async function run() {
  await runForPool(primaryPool, "primary");
  await runForPool(replicaPool, "replica");
}

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await primaryPool.end();
    await replicaPool.end();
  });
