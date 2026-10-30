const { AppError } = require("./errorHandler");

/**
 * Small in-memory limit for summary requests.
 * It resets when the API process restarts and is not a substitute
 * for authentication on a public deployment.
 */
function createRateLimiter() {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const maxRequests = Number(process.env.RATE_LIMIT_MAX || 20);
  const enabled = process.env.NODE_ENV !== "test" || process.env.RATE_LIMIT_ENABLED === "true";
  const hits = new Map();

  return function rateLimiter(req, _res, next) {
    if (!enabled) {
      return next();
    }

    const now = Date.now();
    const key = req.ip || "unknown";
    const recent = (hits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= maxRequests) {
      return next(
        new AppError(429, "RATE_LIMITED", "Too many summary requests. Wait a few minutes and try again.")
      );
    }
    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

module.exports = { createRateLimiter };
