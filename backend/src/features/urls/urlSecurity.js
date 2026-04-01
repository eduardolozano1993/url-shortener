const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{1,32}$/;

/**
 * Reduces a full URL to the parts that are useful in logs without printing
 * sensitive query strings or fragments.
 *
 * @param {URL} url
 * @returns {{host: string, pathname: string, protocol: string}}
 */
function summarizeUrl(url) {
  return {
    host: url.host,
    pathname: url.pathname,
    protocol: url.protocol,
  };
}

/**
 * Validates user input and normalizes it into a `URL` instance for downstream code.
 *
 * @param {unknown} originalUrl
 * @returns {URL}
 */
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

/**
 * Guards the redirect route from malformed or obviously invalid codes.
 *
 * @param {string} code
 * @returns {boolean}
 */
function validateShortCode(code) {
  return SHORT_CODE_PATTERN.test(code);
}

/**
 * Builds the public short URL returned by the API.
 *
 * @param {string} publicBaseUrl
 * @param {string} code
 * @returns {string}
 */
function buildShortUrl(publicBaseUrl, code) {
  return new URL(code, publicBaseUrl).toString();
}

module.exports = {
  buildShortUrl,
  normalizeOriginalUrl,
  summarizeUrl,
  validateShortCode,
};
