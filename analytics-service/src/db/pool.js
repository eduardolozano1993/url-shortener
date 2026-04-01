const { Pool } = require("pg");
const {
  analyticsDatabaseUrl,
  analyticsDbHost,
  analyticsDbPort,
  analyticsDbName,
  analyticsDbUser,
  analyticsDbPassword,
} = require("../config");

/**
 * Shared PostgreSQL pool for analytics writes and reads.
 */
const analyticsPool = new Pool(
  analyticsDatabaseUrl
    ? { connectionString: analyticsDatabaseUrl }
    : {
        host: analyticsDbHost,
        port: analyticsDbPort,
        database: analyticsDbName,
        user: analyticsDbUser,
        password: analyticsDbPassword,
      },
);

/**
 * Closes the analytics database pool during shutdown.
 *
 * @returns {Promise<void>}
 */
async function closePool() {
  await analyticsPool.end();
}

module.exports = {
  analyticsPool,
  closePool,
};
