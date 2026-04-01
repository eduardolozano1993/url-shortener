const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createFakeRedisClient() {
  const counts = new Map();

  return {
    async eval(_script, options) {
      const key = options.keys[0];
      const nextValue = (counts.get(key) || 0) + 1;
      counts.set(key, nextValue);
      return nextValue;
    },
  };
}

function loadAppWithMocks(options = {}) {
  process.env.PUBLIC_BASE_URL = "https://sho.rt/";

  clearModule("../src/bootstrap/app");
  clearModule("../src/config");
  clearModule("../src/modules/urls/urlRoutes");
  clearModule("../src/infrastructure/cache/redisClient");
  clearModule("../src/modules/urls/urlRepository");
  clearModule("../src/infrastructure/messaging/analyticsPublisher");
  clearModule("../src/infrastructure/http/ipRateLimiter");
  clearModule("../src/infrastructure/metrics/metrics");

  const redisClientModule = require("../src/infrastructure/cache/redisClient");
  const fakeRedisClient = options.fakeRedisClient || createFakeRedisClient();
  redisClientModule.connectRedis = async () => {
    if (options.redisError) {
      throw new Error(options.redisError);
    }

    return fakeRedisClient;
  };

  const repository = require("../src/modules/urls/urlRepository");
  repository.createShortUrl = async (originalUrl) => ({
    code: "abc123",
    createdAt: new Date("2026-03-31T00:00:00.000Z").toISOString(),
    id: 1,
    originalUrl,
  });
  repository.getUrlByCode = async () => ({
    code: "abc123",
    createdAt: new Date("2026-03-31T00:00:00.000Z").toISOString(),
    id: 1,
    originalUrl: "https://example.com/",
  });

  const analyticsPublisher = require("../src/infrastructure/messaging/analyticsPublisher");
  analyticsPublisher.publishUrlClicked = async () => null;

  return {
    app: require("../src/bootstrap/app"),
    fakeRedisClient,
  };
}

async function withServer(app, callback) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test("allows requests up to the 100 per hour limit and blocks the 101st", async () => {
  const { app } = loadAppWithMocks();

  await withServer(app, async (baseUrl) => {
    let response;

    for (let attempt = 1; attempt <= 100; attempt += 1) {
      response = await fetch(`${baseUrl}/shorten`, {
        body: JSON.stringify({ originalUrl: `https://example.com/${attempt}` }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        method: "POST",
      });

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("x-ratelimit-limit"), "100");
      assert.equal(response.headers.get("x-ratelimit-remaining"), String(100 - attempt));
    }

    response = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/blocked" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      method: "POST",
    });

    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {
      error: "Rate limit exceeded",
    });
    assert.equal(response.headers.get("x-ratelimit-limit"), "100");
    assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
    assert.match(response.headers.get("retry-after"), /^\d+$/);
  });
});

test("rate limit window helpers reset on the next UTC hour", () => {
  const {
    getCurrentWindowKey,
    getSecondsUntilNextWindow,
  } = require("../src/infrastructure/http/ipRateLimiter");

  const nearHourEnd = new Date("2026-04-01T10:59:59.250Z");
  const nextHour = new Date("2026-04-01T11:00:00.250Z");

  assert.equal(getSecondsUntilNextWindow(nearHourEnd), 1);
  assert.notEqual(
    getCurrentWindowKey("203.0.113.9", nearHourEnd),
    getCurrentWindowKey("203.0.113.9", nextHour),
  );
});

test("tracks quotas independently per client IP", async () => {
  const { app } = loadAppWithMocks();

  await withServer(app, async (baseUrl) => {
    const firstIpResponse = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/one" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.1",
      },
      method: "POST",
    });

    const secondIpResponse = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/two" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.2",
      },
      method: "POST",
    });

    assert.equal(firstIpResponse.status, 201);
    assert.equal(firstIpResponse.headers.get("x-ratelimit-remaining"), "99");
    assert.equal(secondIpResponse.status, 201);
    assert.equal(secondIpResponse.headers.get("x-ratelimit-remaining"), "99");
  });
});

test("bypasses rate limiting for health and metrics endpoints", async () => {
  const { app } = loadAppWithMocks({
    redisError: "redis unavailable",
  });

  await withServer(app, async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get("x-ratelimit-limit"), null);

    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    assert.equal(metricsResponse.status, 200);
    assert.equal(metricsResponse.headers.get("x-ratelimit-limit"), null);
  });
});

test("uses forwarded client IPs when trust proxy is enabled", async () => {
  const { app } = loadAppWithMocks();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/proxy" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50, 10.0.0.2",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-ratelimit-remaining"), "99");
  });
});

test("fails open when Redis is unavailable", async () => {
  const { app } = loadAppWithMocks({
    redisError: "redis unavailable",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/fail-open" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.77",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-ratelimit-limit"), null);
  });
});
