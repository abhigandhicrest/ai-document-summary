class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = error.expose
    ? error.message
    : "Something went wrong. Please try again.";

  if (!error.expose) {
    console.error(`Request failed: ${code}`);
  }

  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { AppError, asyncHandler, errorHandler };
