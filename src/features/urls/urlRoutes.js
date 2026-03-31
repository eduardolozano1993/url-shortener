const express = require("express");
const repository = require("./urlRepository");

const router = express.Router();

router.post("/shorten", async (req, res, next) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: "originalUrl is required" });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return res.status(400).json({ error: "originalUrl must be a valid URL" });
    }

    const url = await repository.createShortUrl(parsedUrl.toString(), req.redisClient);

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
  try {
    const url = await repository.getUrlByCode(req.params.code, req.redisClient);

    if (!url) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    return res.redirect(url.originalUrl);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
