const { afterEach, describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

process.env.NODE_ENV = "test";
process.env.PYTHON_SERVICE_URL = "http://127.0.0.1:9";
process.env.PYTHON_SERVICE_TOKEN = "test-token";
process.env.AI_REQUEST_TIMEOUT_MS = "1000";

const aiService = require("../services/aiService");

const file = {
  buffer: Buffer.from("A note about the March launch."),
  filename: "notes.txt",
  fileType: "txt",
};

describe("Python service client", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("sends the document with the private service token", async () => {
    let captured = null;
    mock.method(axios, "post", async (url, _body, config) => {
      captured = { url, config };
      return {
        data: {
          success: true,
          filename: "notes.txt",
          summary: ["The note describes a March launch."],
          model: "amazon.nova-lite-v1:0",
        },
      };
    });

    const result = await aiService.summarizeDocument(file);
    assert.equal(captured.url, "http://127.0.0.1:9/summarize");
    assert.equal(captured.config.headers["X-Service-Token"], "test-token");
    assert.equal(result.model, "amazon.nova-lite-v1:0");
  });

  it("reports that the Python service is unavailable", async () => {
    mock.method(axios, "post", async () => {
      const error = new Error("connect ECONNREFUSED");
      error.code = "ECONNREFUSED";
      throw error;
    });
    await assert.rejects(() => aiService.summarizeDocument(file), (error) => {
      assert.equal(error.code, "PYTHON_SERVICE_UNAVAILABLE");
      assert.equal(error.status, 503);
      return true;
    });
  });

  it("reports a timeout", async () => {
    mock.method(axios, "post", async () => {
      const error = new Error("timeout");
      error.code = "ECONNABORTED";
      throw error;
    });
    await assert.rejects(() => aiService.summarizeDocument(file), (error) => {
      assert.equal(error.code, "SUMMARIZATION_TIMEOUT");
      assert.equal(error.status, 504);
      return true;
    });
  });

  it("forwards a safe Bedrock access-denied message", async () => {
    mock.method(axios, "post", async () => {
      const error = new Error("denied");
      error.response = {
        status: 503,
        data: {
          error: {
            code: "BEDROCK_ACCESS_DENIED",
            message:
              "Amazon Bedrock denied access to the configured model. Check the model ID, Region, and IAM permissions.",
          },
        },
      };
      throw error;
    });
    await assert.rejects(() => aiService.summarizeDocument(file), (error) => {
      assert.equal(error.code, "BEDROCK_ACCESS_DENIED");
      assert.equal(String(error.message).includes("arn:aws"), false);
      return true;
    });
  });

  it("forwards throttling without internal details", async () => {
    mock.method(axios, "post", async () => {
      const error = new Error("busy");
      error.response = {
        status: 503,
        data: {
          error: {
            code: "BEDROCK_THROTTLED",
            message: "Amazon Bedrock is temporarily busy. Wait a moment and try again.",
          },
        },
      };
      throw error;
    });
    await assert.rejects(() => aiService.summarizeDocument(file), (error) => {
      assert.equal(error.code, "BEDROCK_THROTTLED");
      assert.equal(error.status, 503);
      return true;
    });
  });

  it("does not expose a token mismatch as a client authentication error", async () => {
    mock.method(axios, "post", async () => {
      const error = new Error("unauthorized");
      error.response = {
        status: 401,
        data: { error: { code: "UNAUTHORIZED", message: "The request is not authorized." } },
      };
      throw error;
    });
    await assert.rejects(() => aiService.summarizeDocument(file), (error) => {
      assert.equal(error.code, "PYTHON_SERVICE_UNAUTHORIZED");
      assert.equal(error.status, 503);
      assert.equal(String(error.message).includes("test-token"), false);
      return true;
    });
  });
});
