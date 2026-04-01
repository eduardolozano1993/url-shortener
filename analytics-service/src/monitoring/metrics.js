const processStartTimeSeconds = Date.now() / 1000;
const requestDurationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const counters = new Map();
const histograms = new Map();

/**
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
 * Produces a stable label key so equivalent label sets aggregate together.
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
 * Maps a request to its route template for cleaner Prometheus cardinality.
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

  incrementCounter("analytics_service_http_requests_total", labels);
  observeHistogram(
    "analytics_service_http_request_duration_seconds",
    labels,
    durationSeconds,
    requestDurationBuckets,
  );
}

/**
 * Tracks whether queue messages were processed successfully, retried, or failed.
 *
 * @param {"success"|"retry"|"failed"} result
 * @returns {void}
 */
function recordAnalyticsEvent(result) {
  incrementCounter("analytics_service_events_processed_total", { result });
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
 * Renders all analytics-service metrics in Prometheus text format.
 *
 * @returns {string}
 */
function getMetricsText() {
  const lines = [
    "# HELP app_info Static information about this service.",
    "# TYPE app_info gauge",
    'app_info{service="analytics-service"} 1',
    "# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.",
    "# TYPE process_start_time_seconds gauge",
    `process_start_time_seconds ${processStartTimeSeconds.toFixed(3)}`,
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `${`process_uptime_seconds ${process.uptime().toFixed(3)}`}`,
    "# HELP analytics_service_http_requests_total Total HTTP requests handled by the analytics service.",
    "# TYPE analytics_service_http_requests_total counter",
  ];

  for (const metric of renderCounter("analytics_service_http_requests_total").values()) {
    lines.push(
      `analytics_service_http_requests_total${renderLabels(metric.labels)} ${metric.value}`,
    );
  }

  lines.push(
    "# HELP analytics_service_http_request_duration_seconds HTTP request duration histogram for the analytics service.",
    "# TYPE analytics_service_http_request_duration_seconds histogram",
  );

  for (const metric of renderHistogram("analytics_service_http_request_duration_seconds").values()) {
    let cumulativeCount = 0;

    // Histogram buckets must be emitted cumulatively for Prometheus compatibility.
    requestDurationBuckets.forEach((bucket, index) => {
      cumulativeCount += metric.bucketCounts[index];
      lines.push(
        `analytics_service_http_request_duration_seconds_bucket${renderLabels({
          ...metric.labels,
          le: bucket,
        })} ${cumulativeCount}`,
      );
    });

    lines.push(
      `analytics_service_http_request_duration_seconds_bucket${renderLabels({
        ...metric.labels,
        le: "+Inf",
      })} ${metric.count}`,
    );
    lines.push(
      `analytics_service_http_request_duration_seconds_sum${renderLabels(metric.labels)} ${metric.sum.toFixed(6)}`,
    );
    lines.push(
      `analytics_service_http_request_duration_seconds_count${renderLabels(metric.labels)} ${metric.count}`,
    );
  }

  lines.push(
    "# HELP analytics_service_events_processed_total Analytics consumer events grouped by result.",
    "# TYPE analytics_service_events_processed_total counter",
  );

  for (const metric of renderCounter("analytics_service_events_processed_total").values()) {
    lines.push(
      `analytics_service_events_processed_total${renderLabels(metric.labels)} ${metric.value}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

module.exports = {
  getMetricsText,
  recordAnalyticsEvent,
  recordHttpRequest,
};
