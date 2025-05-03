const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "USD",
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed","expired","refunded"],
    default: "pending",
  },
  transactionId: {
    type: String,
    required: true,
  },
  blog: {
    type: Schema.Types.ObjectId,
    ref: "Blog",
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  paymentType: {
    type: String,
    enum: ["featured", "subscription"],
    required: true,
  },
  saleId:{
    type: String,
    required: true,
    unique: true,
    description: "Unique identifier for the sale transaction.",
    example: "sale_1234567890",
  },
  subscriptionDetails: {
    startDate: {
      type: Date,
      default: function () {
        return this.paymentType === "subscription" ? Date.now() : undefined;
      },
    },
    endDate: {
      type: Date,
      required: function () {
        return this.paymentType === "subscription";
      },
    },
    frequency: {
      type: String,
      enum: ["weekly", "monthly"],
      required: function () {
        return this.paymentType === "subscription";
      },
    },
  },
  featuredDetails: {
    featureDuration: {
      type: Number,
      required: function () {
        return this.paymentType === "featured";
      },
      description: "Duration in days for which the blog will be featured.",
    },
    featuredAt: {
      type: Date,
      default: function () {
        return this.paymentType === "featured" ? Date.now() : undefined;
      },
    },
  },
});

module.exports = mongoose.model("Payment", PaymentSchema);
