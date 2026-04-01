const crypto = require("crypto");
const util = require("util");

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

/**
 * @returns {string}
 */
function now() {
  return new Date().toISOString();
}

/**
 * Pretty-prints structured payloads for terminal logs.
 *
 * @param {unknown} data
 * @returns {string}
 */
function formatData(data) {
  if (data === undefined) {
    return "";
  }

  return util.inspect(data, {
    depth: 6,
    colors: true,
    compact: false,
    breakLength: 100,
    sorted: true,
  });
}

/**
 * Renders one log line plus an optional structured payload.
 *
 * @param {string} color
 * @param {string} requestId
 * @param {string} flow
 * @param {string} label
 * @param {string} message
 * @param {unknown} data
 * @returns {void}
 */
function printLine(color, requestId, flow, label, message, data) {
  const header =
    `${COLORS.dim}${now()}${COLORS.reset} ` +
    `${COLORS.magenta}[req:${requestId}]${COLORS.reset} ` +
    `${COLORS.cyan}[${flow}]${COLORS.reset} ` +
    `${color}${label}${COLORS.reset} ${message}`;

  console.log(header);

  if (data !== undefined) {
    console.log(`${COLORS.dim}  data:${COLORS.reset} ${formatData(data)}`);
  }
}

/**
 * Creates a lightweight structured logger that keeps a shared request id across
 * nested flows.
 *
 * @param {string} flow
 * @param {string} [requestId]
 * @returns {{
 *   requestId: string,
 *   flow: string,
 *   child(nextFlow: string): ReturnType<typeof createFlowLogger>,
 *   start(message: string, data?: unknown): void,
 *   step(message: string, data?: unknown): void,
 *   success(message: string, data?: unknown): void,
 *   warn(message: string, data?: unknown): void,
 *   error(message: string, data?: unknown): void
 * }}
 */
function createFlowLogger(flow, requestId = crypto.randomBytes(3).toString("hex")) {
  return {
    requestId,
    flow,
    child(nextFlow) {
      return createFlowLogger(nextFlow, requestId);
    },
    start(message, data) {
      printLine(COLORS.blue, requestId, flow, "START ", message, data);
    },
    step(message, data) {
      printLine(COLORS.cyan, requestId, flow, "STEP  ", message, data);
    },
    success(message, data) {
      printLine(COLORS.green, requestId, flow, "OK    ", message, data);
    },
    warn(message, data) {
      printLine(COLORS.yellow, requestId, flow, "WARN  ", message, data);
    },
    error(message, data) {
      printLine(COLORS.red, requestId, flow, "ERROR ", message, data);
    },
  };
}

module.exports = {
  createFlowLogger,
};
