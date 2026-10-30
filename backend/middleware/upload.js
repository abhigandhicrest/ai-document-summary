const multer = require("multer");
const { AppError } = require("./errorHandler");

function createUploadMiddleware() {
  const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 10);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fileSize: maxMb * 1024 * 1024,
    },
  });

  return function uploadDocument(req, res, next) {
    upload.single("document")(req, res, (error) => {
      if (!error) {
        return next();
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(413, "FILE_TOO_LARGE", `The file exceeds the ${maxMb} MB upload limit.`)
          );
        }
        return next(new AppError(400, "INVALID_UPLOAD", "Upload one document using the document field."));
      }
      return next(error);
    });
  };
}

module.exports = { createUploadMiddleware };
