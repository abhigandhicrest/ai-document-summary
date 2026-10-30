const { after, afterEach, before, describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.NODE_ENV = "test";
process.env.MAX_FILE_SIZE_MB = "10";
process.env.PYTHON_SERVICE_URL = "http://127.0.0.1:9";
process.env.PYTHON_SERVICE_TOKEN = "test-token";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.PYTHON_HEALTH_TIMEOUT_MS = "300";
process.env.AI_REQUEST_TIMEOUT_MS = "1000";
delete process.env.MONGODB_URI;

const { createApp } = require("../server");
const aiService = require("../services/aiService");
const summaryStore = require("../services/summaryStore");

const SAMPLE_ID = "64b7f3a2c1d4e5f678901234";

describe("Express API", () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp();
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("reports health without secrets", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.service, "express");
    assert.equal(body.database, "disconnected");
    assert.equal(body.pythonService, "down");
    assert.equal(JSON.stringify(body).includes("test-token"), false);
    assert.equal(JSON.stringify(body).includes("MONGODB"), false);
  });

  it("accepts a txt file and does not claim it was saved when MongoDB is down", async () => {
    mockSummary();
    const response = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: textFile("notes.txt", "The project timeline starts in March."),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.persisted, false);
    assert.match(body.message, /history/i);
    assert.deepEqual(body.summary.summary, ["The note describes the project timeline."]);
    assert.equal(body.summary.filename, "notes.txt");
    assert.equal(JSON.stringify(body).includes("The project timeline starts"), false);
  });

  it("accepts pdf and docx payloads and forwards a safe filename", async () => {
    let captured = null;
    mock.method(aiService, "summarizeDocument", async (file) => {
      captured = file;
      return {
        summary: ["A forwarded document summary."],
        model: "amazon.nova-lite-v1:0",
      };
    });

    const pdf = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: binaryFile("research.pdf", Buffer.from("%PDF-1.4\nobject"), "application/pdf"),
    });
    assert.equal(pdf.status, 200);
    assert.equal(captured.fileType, "pdf");

    const docx = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: binaryFile(
        "..\\..\\report.docx",
        Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml")]),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ),
    });
    const body = await docx.json();
    assert.equal(docx.status, 200);
    assert.equal(captured.filename, "report.docx");
    assert.equal(body.summary.filename, "report.docx");
    assert.equal(JSON.stringify(body).includes(".."), false);
  });

  it("rejects an unsupported file type before calling the Python service", async () => {
    mock.method(aiService, "summarizeDocument", async () => {
      throw new Error("unsupported files must not be forwarded");
    });
    const response = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: binaryFile("photo.png", Buffer.from("not-an-image"), "image/png"),
    });
    const body = await response.json();
    assert.equal(response.status, 415);
    assert.equal(body.error.code, "UNSUPPORTED_FILE_TYPE");
  });

  it("rejects an empty file", async () => {
    const response = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: textFile("empty.txt", ""),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "EMPTY_FILE");
  });

  it("rejects a PDF extension whose bytes are not a PDF", async () => {
    const response = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: textFile("notes.pdf", "This is plain text."),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_DOCUMENT");
  });

  it("returns history errors when MongoDB is unavailable", async () => {
    const list = await fetch(`${baseUrl}/api/summaries`);
    const one = await fetch(`${baseUrl}/api/summaries/${SAMPLE_ID}`);
    const removed = await fetch(`${baseUrl}/api/summaries/${SAMPLE_ID}`, { method: "DELETE" });
    assert.equal(list.status, 503);
    assert.equal(one.status, 503);
    assert.equal(removed.status, 503);
    assert.equal((await list.json()).error.code, "DATABASE_UNAVAILABLE");
  });

  it("returns one summary and deletes it through the history endpoints", async () => {
    const record = {
      id: SAMPLE_ID,
      filename: "notes.txt",
      fileType: "txt",
      fileSize: 24,
      summary: ["The note describes the project timeline."],
      modelId: "amazon.nova-lite-v1:0",
      createdAt: "2026-03-03T00:00:00.000Z",
    };
    mock.method(summaryStore, "isAvailable", () => true);
    mock.method(summaryStore, "list", async () => ({
      items: [record],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    }));
    mock.method(summaryStore, "getById", async () => record);
    mock.method(summaryStore, "remove", async () => record);

    const list = await fetch(`${baseUrl}/api/summaries`);
    const listed = await list.json();
    assert.equal(list.status, 200);
    assert.equal(listed.items[0].filename, "notes.txt");
    assert.equal(JSON.stringify(listed).includes("original document"), false);

    const single = await fetch(`${baseUrl}/api/summaries/${SAMPLE_ID}`);
    assert.equal(single.status, 200);
    assert.equal((await single.json()).summary.id, SAMPLE_ID);

    const removed = await fetch(`${baseUrl}/api/summaries/${SAMPLE_ID}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).success, true);
  });

  it("rejects an invalid summary id", async () => {
    const response = await fetch(`${baseUrl}/api/summaries/not-an-id`);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_ID");
  });

  it("hides unexpected internal errors", async () => {
    mock.method(aiService, "summarizeDocument", async () => {
      throw new Error("D:\\secret\\uploads\\notes.txt token=test-token");
    });
    const response = await fetch(`${baseUrl}/api/summaries`, {
      method: "POST",
      body: textFile("notes.txt", "A normal note with enough text."),
    });
    const raw = await response.text();
    const body = JSON.parse(raw);
    assert.equal(response.status, 500);
    assert.equal(body.error.message, "Something went wrong. Please try again.");
    assert.equal(raw.includes("secret"), false);
    assert.equal(raw.includes("stack"), false);
    assert.equal(raw.includes("test-token"), false);
  });
});

function mockSummary() {
  mock.method(aiService, "summarizeDocument", async () => ({
    success: true,
    filename: "notes.txt",
    summary: ["The note describes the project timeline."],
    model: "amazon.nova-lite-v1:0",
  }));
}

function textFile(name, contents) {
  const form = new FormData();
  form.append("document", new File([contents], name, { type: "text/plain" }), name);
  return form;
}

function binaryFile(name, contents, type) {
  const form = new FormData();
  form.append("document", new File([contents], name, { type }), name);
  return form;
}
