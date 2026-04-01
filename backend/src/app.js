const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const urlRoutes = require("./features/urls/urlRoutes");
const { connectRedis } = require("./cache/redisClient");
const { createFlowLogger } = require("./logging/logger");
const { getMetricsText, recordHttpRequest } = require("./monitoring/metrics");

const app = express();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const hasFrontendBuild = fs.existsSync(frontendDistPath);

app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/metrics", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(getMetricsText());
});

app.use((req, res, next) => {
  const requestStart = process.hrtime.bigint();
  req.logger = createFlowLogger("HTTP");
  req.logger.start("Incoming request", {
    bodyKeys:
      req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - requestStart) / 1_000_000_000;
    recordHttpRequest(req, res, durationSeconds);
    req.logger.success("Request completed", {
      durationMs: Number((durationSeconds * 1000).toFixed(2)),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
    });
    console.log("\n\n\n");
  });

  next();
});

app.use(async (req, _res, next) => {
  try {
    req.redisClient = await connectRedis();
    req.logger.step("Redis client attached to request");
  } catch (error) {
    req.logger.warn("Redis unavailable, continuing without cache", {
      error: error.message,
    });
    req.redisClient = null;
  }

  next();
});

app.use(urlRoutes);

if (hasFrontendBuild) {
  app.get("/", (_req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      name: "url-shortener-backend",
      ok: true,
      endpoints: {
        health: "/health",
        shorten: "/shorten",
        redirectExample: "/:code",
      },
    });
  });
}

app.use((error, req, res, _next) => {
  req.logger.error("Unhandled application error", {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
