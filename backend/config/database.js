const mongoose = require("mongoose");

/**
 * Connect to MongoDB when a URI is configured.
 * A failed connection does not stop document summarization.
 * The URI is never written to the log because it can contain a password.
 */
async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set. Summary history is disabled.");
    return;
  }

  mongoose.connection.on("error", () => {
    console.error("MongoDB reported a connection error.");
  });

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB.");
  } catch (_error) {
    console.error("MongoDB connection failed. History endpoints will stay unavailable.");
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, isDatabaseConnected };
