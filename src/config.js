const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  dbHost: process.env.PGHOST || "localhost",
  dbPort: Number(process.env.PGPORT || 5432),
  dbName: process.env.PGDATABASE || process.env.POSTGRES_DB || "url_shortener",
  dbUser: process.env.PGUSER || process.env.POSTGRES_USER || "postgres",
  dbPassword: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "postgres",
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD,
  redisTtlSeconds: Number(process.env.REDIS_TTL_SECONDS || 3600),
};
