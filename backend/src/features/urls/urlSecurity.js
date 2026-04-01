const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{1,32}$/;

function summarizeUrl(url) {
  return {
    host: url.host,
    pathname: url.pathname,
    protocol: url.protocol,
  };
}

function normalizeOriginalUrl(originalUrl) {
  if (typeof originalUrl !== "string" || originalUrl.trim() === "") {
    const error = new Error("originalUrl is required");
    error.statusCode = 400;
    throw error;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    const error = new Error("originalUrl must be a valid URL");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    const error = new Error("originalUrl must use http or https");
    error.statusCode = 400;
    throw error;
  }

  return parsedUrl;
}

function validateShortCode(code) {
  return SHORT_CODE_PATTERN.test(code);
}

function buildShortUrl(publicBaseUrl, code) {
  return new URL(code, publicBaseUrl).toString();
}

module.exports = {
  buildShortUrl,
  normalizeOriginalUrl,
  summarizeUrl,
  validateShortCode,
};
