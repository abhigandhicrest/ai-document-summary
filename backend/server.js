const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");

dotenv.config();

const { createSummaryRouter } = require("./routes/summaryRoutes");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDatabase, isDatabaseConnected } = require("./config/database");
const { checkHealth } = require("./services/aiService");

function createApp() {
  const app = express();
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    helmet({
      // The React app runs on another local port and must be allowed to read API responses.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "DELETE"],
    })
  );
  app.use(express.json({ limit: "1mb" }));

  if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      res.on("finish", () => {
        console.log(`${req.method} ${req.path} ${res.statusCode}`);
      });
      next();
    });
  }

  app.get("/api/health", async (_req, res) => {
    const pythonService = await checkHealth();
    res.status(200).json({
      success: true,
      service: "express",
      database: isDatabaseConnected() ? "connected" : "disconnected",
      pythonService,
    });
  });

  app.use("/api/summaries", createSummaryRouter());

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "That API route does not exist." },
    });
  });

  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  const host = process.env.HOST || "127.0.0.1";
  const app = createApp();
  connectDatabase();
  app.listen(port, host, () => {
    console.log(`Express API listening on http://${host}:${port}`);
  });
}

module.exports = { createApp };
