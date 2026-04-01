const { Pool } = require("pg");
const {
  databaseUrl,
  primaryDbHost,
  primaryDbPort,
  primaryDbName,
  primaryDbUser,
  primaryDbPassword,
  replicaDbHost,
  replicaDbPort,
  replicaDbName,
  replicaDbUser,
  replicaDbPassword,
} = require("../config");

/**
 * Creates a `pg` pool config, preferring a single connection string when the
 * environment already provides one.
 *
 * @param {{host: string, port: number, database: string, user: string, password: string}} options
 * @returns {import("pg").PoolConfig}
 */
function buildPoolConfig({ host, port, database, user, password }) {
  return databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host,
        port,
        database,
        user,
        password,
      };
}

const primaryPool = new Pool(
  buildPoolConfig({
    host: primaryDbHost,
    port: primaryDbPort,
    database: primaryDbName,
    user: primaryDbUser,
    password: primaryDbPassword,
  }),
);

const replicaPool = new Pool(
  buildPoolConfig({
    host: replicaDbHost,
    port: replicaDbPort,
    database: replicaDbName,
    user: replicaDbUser,
    password: replicaDbPassword,
  }),
);

/**
 * Closes both pools so shutdown does not hang on open database sockets.
 *
 * @returns {Promise<void>}
 */
async function closeAllPools() {
  await Promise.allSettled([primaryPool.end(), replicaPool.end()]);
}

module.exports = {
  primaryPool,
  replicaPool,
  closeAllPools,
};
