const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const port = Number(process.env.PORT || 4000);
const publicBaseUrl = new URL(
  process.env.PUBLIC_BASE_URL || `http://localhost:${port}/`,
).toString();

module.exports = {
  port,
  publicBaseUrl,
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
  rabbitMqUrl: process.env.RABBITMQ_URL,
  rabbitMqHost: process.env.RABBITMQ_HOST || "localhost",
  rabbitMqPort: Number(process.env.RABBITMQ_PORT || 5672),
  rabbitMqUser: process.env.RABBITMQ_USER || "guest",
  rabbitMqPassword: process.env.RABBITMQ_PASSWORD || "guest",
  rabbitMqVhost: process.env.RABBITMQ_VHOST || "/",
  analyticsExchange: process.env.ANALYTICS_EXCHANGE || "analytics.events",
  analyticsClickedRoutingKey:
    process.env.ANALYTICS_CLICKED_ROUTING_KEY || "url.clicked",
  analyticsClickedQueue:
    process.env.ANALYTICS_CLICKED_QUEUE || "analytics.url-clicked",
  analyticsRetryQueue:
    process.env.ANALYTICS_RETRY_QUEUE || "analytics.url-clicked.retry",
  analyticsFailedQueue:
    process.env.ANALYTICS_FAILED_QUEUE || "analytics.url-clicked.failed",
  analyticsRetryDelayMs: Number(process.env.ANALYTICS_RETRY_DELAY_MS || 5000),
  analyticsMaxRetries: Number(process.env.ANALYTICS_MAX_RETRIES || 3),
};
