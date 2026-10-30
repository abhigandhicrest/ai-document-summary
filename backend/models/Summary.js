const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, maxlength: 180 },
    fileType: { type: String, required: true, enum: ["pdf", "docx", "txt"] },
    fileSize: { type: Number, required: true, min: 1 },
    summary: {
      type: [String],
      required: true,
      validate: {
        validator(points) {
          return (
            Array.isArray(points) &&
            points.length > 0 &&
            points.length <= 20 &&
            points.every((point) => typeof point === "string" && point.length > 0 && point.length <= 4000)
          );
        },
        message: "Summary points are missing or too large.",
      },
    },
    modelId: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: true }
);

summarySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Summary", summarySchema);
