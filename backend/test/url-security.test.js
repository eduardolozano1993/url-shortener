const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadAppWithMocks() {
  process.env.PUBLIC_BASE_URL = "https://sho.rt/";

  clearModule("../src/app");
  clearModule("../src/config");
  clearModule("../src/features/urls/urlRoutes");
  clearModule("../src/cache/redisClient");
  clearModule("../src/features/urls/urlRepository");
  clearModule("../src/queue/analyticsPublisher");

  const redisClient = require("../src/cache/redisClient");
  redisClient.connectRedis = async () => null;

  const repository = require("../src/features/urls/urlRepository");
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

  const analyticsPublisher = require("../src/queue/analyticsPublisher");
  analyticsPublisher.publishUrlClicked = async () => null;

  return {
    app: require("../src/app"),
    repository,
    analyticsPublisher,
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

test("normalizeOriginalUrl accepts http and https, rejects unsafe protocols", async () => {
  const { normalizeOriginalUrl } = require("../src/features/urls/urlSecurity");

  assert.equal(normalizeOriginalUrl("https://example.com?a=1").toString(), "https://example.com/?a=1");
  assert.equal(normalizeOriginalUrl("http://example.com/path").toString(), "http://example.com/path");

  assert.throws(
    () => normalizeOriginalUrl("javascript:alert(1)"),
    /originalUrl must use http or https/,
  );
});

test("POST /shorten uses PUBLIC_BASE_URL and rejects javascript URLs", async () => {
  const { app } = loadAppWithMocks();

  await withServer(app, async (baseUrl) => {
    const safeResponse = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "https://example.com/path" }),
      headers: {
        "content-type": "application/json",
        host: "attacker.test",
      },
      method: "POST",
    });

    assert.equal(safeResponse.status, 201);
    assert.deepEqual(await safeResponse.json(), {
      code: "abc123",
      originalUrl: "https://example.com/path",
      shortUrl: "https://sho.rt/abc123",
    });

    const unsafeResponse = await fetch(`${baseUrl}/shorten`, {
      body: JSON.stringify({ originalUrl: "javascript:alert(1)" }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(unsafeResponse.status, 400);
    assert.deepEqual(await unsafeResponse.json(), {
      error: "originalUrl must use http or https",
    });
  });
});

test("GET /:code rejects malformed codes before repository lookup", async () => {
  const { app, repository } = loadAppWithMocks();
  let lookupCalls = 0;

  repository.getUrlByCode = async () => {
    lookupCalls += 1;
    return null;
  };

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bad-code!`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Short code format is invalid",
    });
  });

  assert.equal(lookupCalls, 0);
});

test("GET /:code redirects and publishes an analytics event", async () => {
  const { app, analyticsPublisher } = loadAppWithMocks();
  let publishCalls = 0;

  analyticsPublisher.publishUrlClicked = async (req, url) => {
    publishCalls += 1;
    assert.equal(req.headers.referer, "https://referrer.test/article");
    assert.equal(url.code, "abc123");
    return { eventId: "evt-1" };
  };

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/abc123`, {
      headers: {
        referer: "https://referrer.test/article",
      },
      redirect: "manual",
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://example.com/");
  });

  assert.equal(publishCalls, 1);
});
