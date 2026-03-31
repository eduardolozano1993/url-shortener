const express = require("express");
const repository = require("./urlRepository");

const router = express.Router();

router.post("/shorten", async (req, res, next) => {
  const logger = req.logger.child("SHORTEN");

  try {
    const { originalUrl } = req.body;
    logger.start("Starting shorten flow", { originalUrl });

    if (!originalUrl) {
      logger.warn("Request validation failed", { reason: "originalUrl is required" });
      return res.status(400).json({ error: "originalUrl is required" });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      logger.warn("Request validation failed", {
        reason: "originalUrl must be a valid URL",
        originalUrl,
      });
      return res.status(400).json({ error: "originalUrl must be a valid URL" });
    }

    logger.step("Normalized input URL", { normalizedUrl: parsedUrl.toString() });

    const url = await repository.createShortUrl(
      parsedUrl.toString(),
      req.redisClient,
      logger,
    );

    logger.success("Short URL generated", url);
    return res.status(201).json({
      code: url.code,
      originalUrl: url.originalUrl,
      shortUrl: `${req.protocol}://${req.get("host")}/${url.code}`,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:code", async (req, res, next) => {
  const logger = req.logger.child("READ");

  try {
    logger.start("Starting redirect lookup", { code: req.params.code });

    const url = await repository.getUrlByCode(req.params.code, req.redisClient, logger);

    if (!url) {
      logger.warn("Short code not found", { code: req.params.code });
      return res.status(404).json({ error: "Short URL not found" });
    }

    logger.success("Redirect target resolved", url);
    return res.redirect(url.originalUrl);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
