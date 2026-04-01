const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

module.exports = {
  port: Number(process.env.ANALYTICS_SERVICE_PORT || 4100),
  analyticsDatabaseUrl: process.env.ANALYTICS_DATABASE_URL,
  analyticsDbHost: process.env.ANALYTICS_PGHOST || "localhost",
  analyticsDbPort: Number(process.env.ANALYTICS_PGPORT || 5434),
  analyticsDbName:
    process.env.ANALYTICS_PGDATABASE ||
    process.env.ANALYTICS_POSTGRES_DB ||
    "url_shortener_analytics",
  analyticsDbUser:
    process.env.ANALYTICS_PGUSER || process.env.PGUSER || process.env.POSTGRES_USER || "postgres",
  analyticsDbPassword:
    process.env.ANALYTICS_PGPASSWORD ||
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    "postgres",
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
