const mongoose = require("mongoose");
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    blogId: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "Inappropriate Content",
        "Misleading Information",
        "Spam",
        "Harassment or Bullying",
        "Violence or Harmful Behavior",
        "Hate Speech or Symbols",
        "False Information",
        "Plagiarism",
        "Copyright Violation",
        "Illegal Activity",
        "Scam or Fraud",
        "Impersonation",
        "Sensitive Content",
        "Offensive Language",
        "Other",
      ],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Resolved", "Deleted"],
      default: "Pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
