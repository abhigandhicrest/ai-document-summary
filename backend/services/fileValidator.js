const path = require("path");
const { AppError } = require("../middleware/errorHandler");

const FILE_TYPES = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
};

function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    throw new AppError(400, "NO_FILE", "Choose a document to summarize.");
  }
  if (!file.size || file.buffer.length === 0) {
    throw new AppError(400, "EMPTY_FILE", "The uploaded file is empty.");
  }

  const filename = safeFilename(file.originalname);
  const extension = path.extname(filename).toLowerCase();
  const fileType = FILE_TYPES[extension];
  if (!fileType) {
    throw new AppError(415, "UNSUPPORTED_FILE_TYPE", "Upload a PDF, DOCX, or TXT file.");
  }

  if (fileType === "pdf" && !file.buffer.subarray(0, 1024).includes(Buffer.from("%PDF"))) {
    throw new AppError(
      400,
      "INVALID_DOCUMENT",
      "The file extension says PDF, but the contents are not a PDF."
    );
  }

  if (fileType === "docx" && !isDocx(file.buffer)) {
    throw new AppError(
      400,
      "INVALID_DOCUMENT",
      "The file extension says DOCX, but the contents are not a Word document."
    );
  }

  if (fileType === "txt") {
    validatePlainText(file.buffer);
  }

  return {
    filename,
    fileType,
    size: file.size,
    buffer: file.buffer,
  };
}

function safeFilename(originalName) {
  const normalized = String(originalName || "document").replace(/\\/g, "/");
  const baseName = path.posix.basename(normalized);
  const cleaned = baseName.replace(/[^\w.\- ()]/g, "_").replace(/^\.+/, "").slice(0, 180);
  return cleaned || "document";
}

function isDocx(buffer) {
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  return isZip && buffer.includes(Buffer.from("word/document.xml"));
}

function validatePlainText(buffer) {
  if (buffer.subarray(0, 8192).includes(0)) {
    throw new AppError(400, "INVALID_DOCUMENT", "This text file contains binary data and cannot be read.");
  }
  let decoded = "";
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (_error) {
    throw new AppError(
      422,
      "ENCODING_ERROR",
      "This text file is not valid UTF-8. Save it as UTF-8 and try again."
    );
  }
  if (!decoded.trim()) {
    throw new AppError(422, "NO_EXTRACTABLE_TEXT", "This text file has no usable content.");
  }
}

module.exports = { validateUploadedFile, safeFilename };
