const fs = require("fs/promises");
const path = require("path");
const { primaryPool, replicaPool } = require("./pool");

/**
 * Ensures the bookkeeping table exists before applying file-based migrations.
 *
 * @param {import("pg").Pool} pool
 * @returns {Promise<void>}
 */
async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Loads the set of migration filenames that have already been applied.
 *
 * @param {import("pg").Pool} pool
 * @returns {Promise<Set<string>>}
 */
async function getExecutedMigrations(pool) {
  const result = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

/**
 * Applies all pending SQL migrations to the provided pool.
 *
 * @param {import("pg").Pool} pool
 * @param {string} label
 * @param {string} migrationsDir
 * @returns {Promise<void>}
 */
async function runForPool(pool, label, migrationsDir) {
  const filenames = (await fs.readdir(migrationsDir)).sort();

  await ensureMigrationsTable(pool);
  const executed = await getExecutedMigrations(pool);

  for (const filename of filenames) {
    if (executed.has(filename)) {
      continue;
    }

    const filePath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(filePath, "utf8");

    // Each migration runs in its own transaction so a partial failure cannot leave drift behind.
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

/**
 * Runs the same schema on both the primary and the read replica.
 *
 * @returns {Promise<void>}
 */
async function run() {
  await runForPool(primaryPool, "primary", path.join(__dirname, "migrations", "core"));
  await runForPool(replicaPool, "replica", path.join(__dirname, "migrations", "core"));
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
