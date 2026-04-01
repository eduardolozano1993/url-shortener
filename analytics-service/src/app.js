const express = require("express");
const {
  getDailyByCode,
  getOverview,
  getReferrersByCode,
  getSummaryByCode,
} = require("./analytics/repository");
const { createFlowLogger } = require("./logging/logger");

const app = express();

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  req.logger = createFlowLogger("ANALYTICS_HTTP");
  req.logger.start("Incoming request", {
    method: req.method,
    path: req.originalUrl,
  });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  res.on("finish", () => {
    req.logger.success("Request completed", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
    });
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/analytics/overview", async (req, res, next) => {
  try {
    const overview = await getOverview();
    return res.json(overview);
  } catch (error) {
    return next(error);
  }
});

app.get("/analytics/:code/summary", async (req, res, next) => {
  try {
    const summary = await getSummaryByCode(req.params.code);

    if (!summary) {
      return res.status(404).json({ error: "Analytics summary not found for that code" });
    }

    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

app.get("/analytics/:code/daily", async (req, res, next) => {
  try {
    const daily = await getDailyByCode(req.params.code);
    return res.json({
      code: req.params.code,
      daily,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/analytics/:code/referrers", async (req, res, next) => {
  try {
    const referrers = await getReferrersByCode(req.params.code);
    return res.json({
      code: req.params.code,
      referrers,
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, _next) => {
  req.logger.error("Unhandled analytics error", {
    message: error.message,
  });
  return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
