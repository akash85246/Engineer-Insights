const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    blogId: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportId:{
      type: Schema.Types.ObjectId,
      ref: "Report",
    },
    notificationType: {
      type: String,
      enum: ["new_comment", "new_follower","new_like","new_report","new_login","report_deleted"],
      required: true,
    },
    isRead:{
      type:Boolean,
      default:false,
    },
    subject: {
      type: String,
      required: true, 
    },
    message: {
      type: String,
      required: true, 
    },
    additionalData: {
      type: Object,
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

module.exports = mongoose.model("Notification", notificationSchema);