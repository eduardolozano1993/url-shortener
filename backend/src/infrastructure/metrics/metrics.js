const processStartTimeSeconds = Date.now() / 1000;
const requestDurationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const counters = new Map();
const histograms = new Map();

/**
 * Escapes label values to Prometheus exposition format.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeLabelValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

/**
 * Produces a stable key so labels with the same entries collapse into a single
 * counter or histogram series.
 *
 * @param {Record<string, string>} labels
 * @returns {string}
 */
function getLabelKey(labels) {
  return JSON.stringify(
    Object.keys(labels)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = labels[key];
        return accumulator;
      }, {}),
  );
}

/**
 * Serializes label objects for Prometheus text output.
 *
 * @param {Record<string, string|number>} labels
 * @returns {string}
 */
function renderLabels(labels) {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`;
}

/**
 * Increments an in-memory counter metric.
 *
 * @param {string} name
 * @param {Record<string, string>} labels
 * @param {number} [value]
 * @returns {void}
 */
function incrementCounter(name, labels, value = 1) {
  const key = getLabelKey(labels);
  const existing = counters.get(name) || new Map();
  existing.set(key, {
    labels,
    value: (existing.get(key)?.value || 0) + value,
  });
  counters.set(name, existing);
}

/**
 * Observes a histogram sample by updating every matching bucket plus the sum/count.
 *
 * @param {string} name
 * @param {Record<string, string>} labels
 * @param {number} value
 * @param {number[]} buckets
 * @returns {void}
 */
function observeHistogram(name, labels, value, buckets) {
  const key = getLabelKey(labels);
  const existing = histograms.get(name) || new Map();
  const current =
    existing.get(key) ||
    {
      labels,
      bucketCounts: new Array(buckets.length).fill(0),
      count: 0,
      sum: 0,
    };

  current.count += 1;
  current.sum += value;

  buckets.forEach((bucket, index) => {
    if (value <= bucket) {
      current.bucketCounts[index] += 1;
    }
  });

  existing.set(key, current);
  histograms.set(name, existing);
}

/**
 * Uses Express route metadata when available so metrics aggregate by template
 * path instead of raw ids or codes.
 *
 * @param {import("express").Request} req
 * @returns {string}
 */
function normalizeRoute(req) {
  if (req.route?.path) {
    const basePath = req.baseUrl || "";
    return `${basePath}${req.route.path}` || "/";
  }

  return "unmatched";
}

/**
 * Records one backend HTTP request in the in-memory metrics registry.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {number} durationSeconds
 * @returns {void}
 */
function recordHttpRequest(req, res, durationSeconds) {
  const labels = {
    method: req.method,
    route: normalizeRoute(req),
    status_code: String(res.statusCode),
  };

  incrementCounter("url_shortener_http_requests_total", labels);
  observeHistogram(
    "url_shortener_http_request_duration_seconds",
    labels,
    durationSeconds,
    requestDurationBuckets,
  );
}

/**
 * @returns {void}
 */
function recordShortUrlCreated() {
  incrementCounter("url_shortener_urls_created_total", {});
}

/**
 * @param {"found"|"not_found"|"invalid"} result
 * @returns {void}
 */
function recordRedirectResult(result) {
  incrementCounter("url_shortener_redirects_total", { result });
}

/**
 * @param {"allowed"|"blocked"|"failed_open"} result
 * @returns {void}
 */
function recordRateLimitDecision(result) {
  incrementCounter("url_shortener_rate_limit_requests_total", { result });
}

/**
 * @param {string} name
 * @returns {Map<string, {labels: Record<string, string>, value: number}>}
 */
function renderCounter(name) {
  return counters.get(name) || new Map();
}

/**
 * @param {string} name
 * @returns {Map<string, {labels: Record<string, string>, bucketCounts: number[], count: number, sum: number}>}
 */
function renderHistogram(name) {
  return histograms.get(name) || new Map();
}

/**
 * Renders the current in-memory registry in Prometheus text exposition format.
 *
 * @returns {string}
 */
function getMetricsText() {
  const lines = [
    "# HELP app_info Static information about this service.",
    "# TYPE app_info gauge",
    'app_info{service="backend"} 1',
    "# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.",
    "# TYPE process_start_time_seconds gauge",
    `process_start_time_seconds ${processStartTimeSeconds.toFixed(3)}`,
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `${`process_uptime_seconds ${process.uptime().toFixed(3)}`}`,
    "# HELP url_shortener_http_requests_total Total HTTP requests handled by the backend service.",
    "# TYPE url_shortener_http_requests_total counter",
  ];

  for (const metric of renderCounter("url_shortener_http_requests_total").values()) {
    lines.push(
      `url_shortener_http_requests_total${renderLabels(metric.labels)} ${metric.value}`,
    );
  }

  lines.push(
    "# HELP url_shortener_http_request_duration_seconds HTTP request duration histogram for the backend service.",
    "# TYPE url_shortener_http_request_duration_seconds histogram",
  );

  for (const metric of renderHistogram("url_shortener_http_request_duration_seconds").values()) {
    let cumulativeCount = 0;

    // Prometheus histogram buckets are cumulative, so each line includes all
    // observations up to the current upper bound.
    requestDurationBuckets.forEach((bucket, index) => {
      cumulativeCount += metric.bucketCounts[index];
      lines.push(
        `url_shortener_http_request_duration_seconds_bucket${renderLabels({
          ...metric.labels,
          le: bucket,
        })} ${cumulativeCount}`,
      );
    });

    lines.push(
      `url_shortener_http_request_duration_seconds_bucket${renderLabels({
        ...metric.labels,
        le: "+Inf",
      })} ${metric.count}`,
    );
    lines.push(
      `url_shortener_http_request_duration_seconds_sum${renderLabels(metric.labels)} ${metric.sum.toFixed(6)}`,
    );
    lines.push(
      `url_shortener_http_request_duration_seconds_count${renderLabels(metric.labels)} ${metric.count}`,
    );
  }

  lines.push(
    "# HELP url_shortener_urls_created_total Total shortened URLs created.",
    "# TYPE url_shortener_urls_created_total counter",
  );

  for (const metric of renderCounter("url_shortener_urls_created_total").values()) {
    lines.push(
      `url_shortener_urls_created_total${renderLabels(metric.labels)} ${metric.value}`,
    );
  }

  lines.push(
    "# HELP url_shortener_redirects_total Redirect attempts grouped by result.",
    "# TYPE url_shortener_redirects_total counter",
  );

  for (const metric of renderCounter("url_shortener_redirects_total").values()) {
    lines.push(`url_shortener_redirects_total${renderLabels(metric.labels)} ${metric.value}`);
  }

  lines.push(
    "# HELP url_shortener_rate_limit_requests_total Backend IP rate limit decisions grouped by result.",
    "# TYPE url_shortener_rate_limit_requests_total counter",
  );

  for (const metric of renderCounter("url_shortener_rate_limit_requests_total").values()) {
    lines.push(
      `url_shortener_rate_limit_requests_total${renderLabels(metric.labels)} ${metric.value}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

module.exports = {
  getMetricsText,
  recordHttpRequest,
  recordRateLimitDecision,
  recordRedirectResult,
  recordShortUrlCreated,
};
