const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const multer = require("multer");
const { once } = require("node:events");

process.env.NODE_ENV = "test";
process.env.PYTHON_SERVICE_TOKEN = "test-token";
process.env.AI_REQUEST_TIMEOUT_MS = "5000";

const aiService = require("../services/aiService");

describe("multipart forwarding", () => {
  let server;

  before(async () => {
    const upload = multer({ storage: multer.memoryStorage() });
    const app = express();
    app.post("/summarize", upload.single("file"), (req, res) => {
      if (req.header("x-service-token") !== "test-token") {
        return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "The request is not authorized." } });
      }
      if (!req.file) {
        return res.status(400).json({ error: { code: "NO_FILE", message: "Missing file." } });
      }
      return res.json({
        success: true,
        filename: req.file.originalname,
        summary: ["The forwarded note mentions March."],
        model: "amazon.nova-lite-v1:0",
        text: req.file.buffer.toString("utf8"),
      });
    });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.PYTHON_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("delivers the document bytes to the Python-shaped endpoint", async () => {
    const result = await aiService.summarizeDocument({
      buffer: Buffer.from("Launch in March with a budget of 150000."),
      filename: "notes.txt",
      fileType: "txt",
    });
    assert.equal(result.filename, "notes.txt");
    assert.equal(result.text, "Launch in March with a budget of 150000.");
    assert.deepEqual(result.summary, ["The forwarded note mentions March."]);
  });
});
