const { Pool } = require("pg");
const {
  analyticsDatabaseUrl,
  analyticsDbHost,
  analyticsDbPort,
  analyticsDbName,
  analyticsDbUser,
  analyticsDbPassword,
} = require("../config");

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

async function closePool() {
  await analyticsPool.end();
}

module.exports = {
  analyticsPool,
  closePool,
};
