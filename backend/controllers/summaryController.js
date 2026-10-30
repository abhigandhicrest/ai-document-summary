const summaryStore = require("../services/summaryStore");
const aiService = require("../services/aiService");
const { validateUploadedFile } = require("../services/fileValidator");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

const createSummary = asyncHandler(async (req, res) => {
  const uploaded = validateUploadedFile(req.file);
  const generated = await aiService.summarizeDocument(uploaded);
  const { summary, modelId } = normalizeGeneratedSummary(generated);

  let saved = null;
  let persisted = false;
  let message = null;

  if (summaryStore.isAvailable()) {
    try {
      saved = await summaryStore.save({
        filename: uploaded.filename,
        fileType: uploaded.fileType,
        fileSize: uploaded.size,
        summary,
        modelId,
      });
      persisted = true;
    } catch (_error) {
      console.error("Summary persistence failed.");
      message = "The summary was generated but could not be saved to history.";
    }
  } else {
    message = "The summary was generated but history storage is unavailable.";
  }

  res.status(200).json({
    success: true,
    persisted,
    message,
    summary: {
      id: saved?.id || null,
      filename: uploaded.filename,
      fileType: uploaded.fileType,
      fileSize: uploaded.size,
      summary,
      modelId,
      createdAt: saved?.createdAt || new Date().toISOString(),
    },
  });
});

const listSummaries = asyncHandler(async (req, res) => {
  const page = readPositiveNumber(req.query.page, 1, "Page");
  const limit = readPositiveNumber(req.query.limit, 10, "Limit");
  if (limit > 50) {
    throw new AppError(400, "INVALID_LIMIT", "Limit must be 50 or less.");
  }
  const result = await summaryStore.list({ page, limit });
  res.status(200).json({ success: true, ...result });
});

const getSummary = asyncHandler(async (req, res) => {
  summaryStore.assertValidId(req.params.id);
  const summary = await summaryStore.getById(req.params.id);
  res.status(200).json({ success: true, summary });
});

const deleteSummary = asyncHandler(async (req, res) => {
  summaryStore.assertValidId(req.params.id);
  await summaryStore.remove(req.params.id);
  res.status(200).json({ success: true });
});

function normalizeGeneratedSummary(payload) {
  if (!payload || !Array.isArray(payload.summary)) {
    throw new AppError(502, "INVALID_SUMMARY", "The summarization service returned an unexpected result.");
  }
  const summary = payload.summary.map((point) => String(point).trim());
  const modelId = String(payload.model || "").trim();
  const usable =
    summary.length > 0 &&
    summary.length <= 20 &&
    summary.every((point) => point.length > 0 && point.length <= 4000) &&
    modelId.length > 0 &&
    modelId.length <= 200;
  if (!usable) {
    throw new AppError(502, "INVALID_SUMMARY", "The summarization service returned an unexpected result.");
  }
  return { summary, modelId };
}

function readPositiveNumber(value, fallback, label) {
  if (value === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(String(value))) {
    throw new AppError(400, "INVALID_QUERY", `${label} must be a positive whole number.`);
  }
  const parsed = Number(value);
  if (parsed < 1) {
    throw new AppError(400, "INVALID_QUERY", `${label} must be a positive whole number.`);
  }
  return parsed;
}

module.exports = {
  createSummary,
  listSummaries,
  getSummary,
  deleteSummary,
};
