const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const commentSchema = new Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  blog: {
    type: Schema.Types.ObjectId,
    ref: "Blog",
    required: true,
  },
  likes: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  replies: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: "Comment",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

commentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

commentSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

commentSchema.methods.hasLiked = function (userId) {
  return this.likes.includes(userId);
};

commentSchema.methods.toggleLike = function (userId) {
  if (this.likes.includes(userId)) {
    this.likes.pull(userId);
  } else {
    this.likes.push(userId); 
  }
  return this.save();
};

commentSchema.methods.addReply = function (replyId) {
  this.replies.push(replyId);
  return this.save();
};

module.exports = mongoose.models.Comment||mongoose.model("Comment", commentSchema);
