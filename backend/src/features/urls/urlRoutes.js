const express = require("express");
const repository = require("./urlRepository");
const {
  buildShortUrl,
  normalizeOriginalUrl,
  summarizeUrl,
  validateShortCode,
} = require("./urlSecurity");
const { publicBaseUrl } = require("../../config");
const analyticsPublisher = require("../../queue/analyticsPublisher");

const router = express.Router();

router.post("/shorten", async (req, res, next) => {
  const logger = req.logger.child("SHORTEN");

  try {
    const { originalUrl } = req.body;
    logger.start("Starting shorten flow", {
      hasOriginalUrl: Boolean(originalUrl),
    });

    let parsedUrl;

    try {
      parsedUrl = normalizeOriginalUrl(originalUrl);
    } catch (error) {
      logger.warn("Request validation failed", {
        message: error.message,
      });
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    logger.step("Validated input URL", summarizeUrl(parsedUrl));

    const url = await repository.createShortUrl(
      parsedUrl.toString(),
      req.redisClient,
      logger,
    );

    logger.success("Short URL generated", url);
    return res.status(201).json({
      code: url.code,
      originalUrl: url.originalUrl,
      shortUrl: buildShortUrl(publicBaseUrl, url.code),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:code", async (req, res, next) => {
  const logger = req.logger.child("READ");

  try {
    logger.start("Starting redirect lookup", { code: req.params.code });

    if (!validateShortCode(req.params.code)) {
      logger.warn("Short code validation failed", {
        code: req.params.code,
      });
      return res.status(400).json({ error: "Short code format is invalid" });
    }

    const url = await repository.getUrlByCode(req.params.code, req.redisClient, logger);

    if (!url) {
      logger.warn("Short code not found", { code: req.params.code });
      return res.status(404).json({ error: "Short URL not found" });
    }

    logger.success("Redirect target resolved", url);
    await analyticsPublisher.publishUrlClicked(req, url, logger.child("EVENT"));
    return res.redirect(url.originalUrl);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
