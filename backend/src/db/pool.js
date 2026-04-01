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

module.exports = {
  primaryPool,
  replicaPool,
};
