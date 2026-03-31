const express = require("express");
const urlRoutes = require("./features/urls/urlRoutes");
const { connectRedis } = require("./cache/redisClient");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(async (req, _res, next) => {
  try {
    req.redisClient = await connectRedis();
  } catch (error) {
    console.error("Redis unavailable, continuing without cache:", error.message);
    req.redisClient = null;
  }

  next();
});

app.use(urlRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
