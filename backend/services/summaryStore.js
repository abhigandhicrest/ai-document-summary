const Summary = require("../models/Summary");
const database = require("../config/database");
const { AppError } = require("../middleware/errorHandler");

function isAvailable() {
  return database.isDatabaseConnected();
}

function assertDatabase() {
  if (!isAvailable()) {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "Summary history is unavailable because the database is not connected."
    );
  }
}

async function save(input) {
  assertDatabase();
  const document = await Summary.create(input);
  return toClient(document);
}

async function list({ page, limit }) {
  assertDatabase();
  const skip = (page - 1) * limit;
  const [documents, total] = await Promise.all([
    Summary.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Summary.countDocuments(),
  ]);
  return {
    items: documents.map(toClient),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

async function getById(id) {
  assertDatabase();
  assertValidId(id);
  const document = await Summary.findById(id).lean();
  if (!document) {
    throw new AppError(404, "NOT_FOUND", "That summary could not be found.");
  }
  return toClient(document);
}

async function remove(id) {
  assertDatabase();
  assertValidId(id);
  const document = await Summary.findByIdAndDelete(id).lean();
  if (!document) {
    throw new AppError(404, "NOT_FOUND", "That summary could not be found.");
  }
  return toClient(document);
}

function assertValidId(id) {
  if (!/^[a-fA-F0-9]{24}$/.test(String(id || ""))) {
    throw new AppError(400, "INVALID_ID", "The summary id is not valid.");
  }
}

function toClient(document) {
  return {
    id: String(document._id),
    filename: document.filename,
    fileType: document.fileType,
    fileSize: document.fileSize,
    summary: document.summary,
    modelId: document.modelId,
    createdAt: document.createdAt,
  };
}

module.exports = {
  isAvailable,
  save,
  list,
  getById,
  remove,
  assertValidId,
};
