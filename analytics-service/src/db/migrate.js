const fs = require("fs/promises");
const path = require("path");
const { analyticsPool } = require("./pool");

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

async function run() {
  const migrationsDir = path.join(__dirname, "migrations");
  const filenames = (await fs.readdir(migrationsDir)).sort();

  await ensureMigrationsTable(analyticsPool);
  const executed = await getExecutedMigrations(analyticsPool);

  for (const filename of filenames) {
    if (executed.has(filename)) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    await analyticsPool.query("BEGIN");

    try {
      await analyticsPool.query(sql);
      await analyticsPool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await analyticsPool.query("COMMIT");
      console.log(`[analytics] Applied migration: ${filename}`);
    } catch (error) {
      await analyticsPool.query("ROLLBACK");
      throw error;
    }
  }

  console.log("[analytics] Migrations complete");
}

run()
  .catch((error) => {
    console.error("Analytics migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await analyticsPool.end();
  });
