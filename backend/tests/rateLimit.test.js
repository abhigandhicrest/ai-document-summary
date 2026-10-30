const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_ENABLED = "true";
process.env.RATE_LIMIT_MAX = "2";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.MAX_FILE_SIZE_MB = "10";
process.env.PYTHON_SERVICE_URL = "http://127.0.0.1:9";
process.env.PYTHON_SERVICE_TOKEN = "test-token";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.PYTHON_HEALTH_TIMEOUT_MS = "300";
delete process.env.MONGODB_URI;

const { createApp } = require("../server");

describe("summary rate limit", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("blocks extra summary requests", async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/summaries`, {
        method: "POST",
        body: new FormData(),
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [400, 400, 429]);
  });
});
