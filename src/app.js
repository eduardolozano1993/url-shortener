const express = require("express");
const urlRoutes = require("./features/urls/urlRoutes");
const { connectRedis } = require("./cache/redisClient");
const { createFlowLogger } = require("./logging/logger");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((req, res, next) => {
  req.logger = createFlowLogger("HTTP");
  req.logger.start("Incoming request", {
    body: req.body,
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    req.logger.success("Request completed", {
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

app.use((error, req, res, _next) => {
  req.logger.error("Unhandled application error", {
    code: error.code,
    message: error.message,
    stack: error.stack,
  });

  if (error.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
