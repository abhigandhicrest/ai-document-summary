const axios = require("axios");
const { AppError } = require("../middleware/errorHandler");

const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/**
 * Forward a validated document to the private Python service.
 * The service token stays on the server and is never sent to React.
 */
async function summarizeDocument(file) {
  const baseUrl = (process.env.PYTHON_SERVICE_URL || "").replace(/\/$/, "");
  const token = process.env.PYTHON_SERVICE_TOKEN || "";
  if (!baseUrl || !token) {
    throw new AppError(
      503,
      "PYTHON_SERVICE_NOT_CONFIGURED",
      "The summarization service is not configured on the API server."
    );
  }

  const form = new FormData();
  const blob = new Blob([file.buffer], { type: MIME_TYPES[file.fileType] || "application/octet-stream" });
  form.append("file", blob, file.filename);

  try {
    const response = await axios.post(`${baseUrl}/summarize`, form, {
      headers: { "X-Service-Token": token },
      timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return response.data;
  } catch (error) {
    throw mapPythonError(error);
  }
}

async function checkHealth() {
  const baseUrl = (process.env.PYTHON_SERVICE_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    return "not-configured";
  }
  try {
    const response = await axios.get(`${baseUrl}/health`, {
      timeout: Number(process.env.PYTHON_HEALTH_TIMEOUT_MS || 2000),
    });
    return response.status === 200 ? "up" : "down";
  } catch (_error) {
    return "down";
  }
}

function mapPythonError(error) {
  if (error.response) {
    const status = error.response.status;
    const body = error.response.data;
    if (status === 401) {
      return new AppError(
        503,
        "PYTHON_SERVICE_UNAUTHORIZED",
        "The API could not authenticate to the summarization service."
      );
    }
    if (body?.error?.code && body?.error?.message) {
      const forwardedStatus = status >= 400 && status < 600 ? status : 502;
      return new AppError(forwardedStatus, body.error.code, body.error.message);
    }
    return new AppError(502, "SUMMARIZATION_FAILED", "The summarization service rejected the document.");
  }

  if (error.code === "ECONNABORTED") {
    return new AppError(
      504,
      "SUMMARIZATION_TIMEOUT",
      "Summarization took too long. Try a smaller document."
    );
  }

  return new AppError(
    503,
    "PYTHON_SERVICE_UNAVAILABLE",
    "The summarization service is unavailable. Start the Python service and try again."
  );
}

module.exports = { summarizeDocument, checkHealth };
