const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.NODE_ENV = "test";
process.env.MAX_FILE_SIZE_MB = "1";
process.env.PYTHON_SERVICE_URL = "http://127.0.0.1:9";
process.env.PYTHON_SERVICE_TOKEN = "test-token";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.PYTHON_HEALTH_TIMEOUT_MS = "300";
delete process.env.MONGODB_URI;

const { createApp } = require("../server");

describe("upload limit", () => {
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

  it("rejects a document over the configured upload limit", async () => {
    const bytes = new Uint8Array(1024 * 1024 + 4096);
    bytes.fill(97);
    const form = new FormData();
    form.append("document", new File([bytes], "large.txt", { type: "text/plain" }), "large.txt");

    const response = await fetch(`${baseUrl}/api/summaries`, { method: "POST", body: form });
    const body = await response.json();
    assert.equal(response.status, 413);
    assert.equal(body.error.code, "FILE_TOO_LARGE");
    assert.match(body.error.message, /1 MB/);
  });
});
