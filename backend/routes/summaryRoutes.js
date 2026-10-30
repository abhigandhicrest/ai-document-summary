const express = require("express");
const { createUploadMiddleware } = require("../middleware/upload");
const { createRateLimiter } = require("../middleware/rateLimiter");
const summaryController = require("../controllers/summaryController");

function createSummaryRouter() {
  const router = express.Router();
  const uploadDocument = createUploadMiddleware();
  const rateLimiter = createRateLimiter();

  router.post("/", rateLimiter, uploadDocument, summaryController.createSummary);
  router.get("/", summaryController.listSummaries);
  router.get("/:id", summaryController.getSummary);
  router.delete("/:id", summaryController.deleteSummary);
  return router;
}

module.exports = { createSummaryRouter };
