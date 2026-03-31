const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  primaryDbHost: process.env.PGHOST || "localhost",
  primaryDbPort: Number(process.env.PGPORT || 5432),
  primaryDbName:
    process.env.PGDATABASE || process.env.POSTGRES_DB || "url_shortener",
  primaryDbUser: process.env.PGUSER || process.env.POSTGRES_USER || "postgres",
  primaryDbPassword:
    process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "postgres",
  replicaDbHost: process.env.PGREPLICA_HOST || process.env.PGHOST || "localhost",
  replicaDbPort: Number(process.env.PGREPLICA_PORT || 5433),
  replicaDbName:
    process.env.PGREPLICA_DATABASE ||
    process.env.PGDATABASE ||
    process.env.POSTGRES_DB ||
    "url_shortener",
  replicaDbUser:
    process.env.PGREPLICA_USER ||
    process.env.PGUSER ||
    process.env.POSTGRES_USER ||
    "postgres",
  replicaDbPassword:
    process.env.PGREPLICA_PASSWORD ||
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    "postgres",
  replicaSyncDelayMs: Number(process.env.REPLICA_SYNC_DELAY_MS || 0),
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD,
  redisTtlSeconds: Number(process.env.REDIS_TTL_SECONDS || 3600),
};
