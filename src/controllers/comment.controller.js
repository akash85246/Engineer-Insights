const mongoose = require("mongoose");
const Comment = require("../models/Comment.model");
const Blog = require("../models/Blog.model");
const User = require("../models/User.model");
const AnalyticModel = require("../models/Analytic.model");

const { createNotification } = require("./notification.controller");

exports.handleNewComment = async (socket, data) => {
  try {
    const { content, author, blog, parentComment } = data.body;

    if (
      !mongoose.Types.ObjectId.isValid(author) ||
      !mongoose.Types.ObjectId.isValid(blog)
    ) {
      console.log("Invalid Author or Blog ID", author, blog);
      return socket.emit("commentError", {
        message: "Invalid user or blog ID",
      });
    }

    if (!content) {
      console.log("Content is required");
      return socket.emit("commentError", { message: "Content is required" });
    }

    const authorDetails = await User.findById(author).select(
      "username avatar firstname lastname "
    );
    if (!authorDetails) {
      console.log("Author not found");
      return socket.emit("commentError", { message: "Author not found" });
    }

    const parentCommentId =
      parentComment && mongoose.Types.ObjectId.isValid(parentComment)
        ? new mongoose.Types.ObjectId(parentComment)
        : null;

    const newComment = new Comment({
      content,
      author: new mongoose.Types.ObjectId(author),
      blog: new mongoose.Types.ObjectId(blog),
      parentComment: parentCommentId,
    });

    await newComment.save();

    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (parent) {
        parent.replies.push(newComment._id);
        await parent.save();
      }
    }

    console.log("New comment created: ", newComment);

    const commentWithAuthor = {
      ...newComment.toObject(),
      author: {
        _id: authorDetails._id,
        firstname: authorDetails.firstname,
        lastname: authorDetails.lastname,
        username: authorDetails.username,
        avatar: authorDetails.avatar,
      },
    };

    const blogDetails = await Blog.findById(blog).select("author");

    const notificationData = {
      blogId: blog,
      user: blogDetails.author,
      notificationType: "new_comment",
      subject: `New comment on your blog`,
      message: ` ${authorDetails.username} commented on your blog ${newComment.content}`,
    };

    const author_Id =blogDetails.author;

    await createNotification(notificationData);

    const currentDate = new Date();
    const dateOnly = new Date(currentDate.setHours(0, 0, 0, 0));
    const currentHour = new Date().getHours();
    const existingEntry = await AnalyticModel.findOne({
      user_id: blogDetails.author,
      "engagementTrend.date": dateOnly,
      "engagementTrend.hour": currentHour,
    });

    if (existingEntry) {
      await AnalyticModel.findOneAndUpdate(
        {
          user_id: blogDetails.author,
          "engagementTrend.date": dateOnly,
          "engagementTrend.hour": currentHour,
        },
        {
          $inc: {
            "engagementTrend.$.comments": 1,
          },
        },
        { new: true }
      );
    } else {
      await AnalyticModel.findOneAndUpdate(
        { user_id: author_Id },
        {
          $push: {
            engagementTrend: {
              date: dateOnly,
              hour: currentHour,
              views: 0,
              likes: 0,
              comments: 1,
              saves: 0,
              reports: 0,
            },
          },
        },
        { new: true, upsert: true }
      );
    }

    socket.emit("commentAdded", commentWithAuthor);
    socket.broadcast.emit("commentAdded", commentWithAuthor);
  } catch (error) {
    console.error("Error handling new comment: ", error);
    socket.emit("commentError", { message: "Failed to create comment", error });
  }
};

exports.toggleLikeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body; // userId from the client

    if (
      !mongoose.Types.ObjectId.isValid(commentId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({ message: "Invalid comment or user ID" });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    // Toggle like
    comment.toggleLike(userId);

    // Return updated comment
    res.status(200).json(comment);
  } catch (error) {
    console.error("Error toggling like on comment:", error);
    res.status(500).json({ message: "Failed to like/unlike comment", error });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = req.user._id;
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this comment" });
    }

    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: comment._id });
    }

    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res
      .status(500)
      .json({ message: "Failed to delete comment", error: error.message });
  }
};

exports.getCommentsByBlog = async (req, res) => {
  try {
    const { blogId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const comments = await Comment.find({ blog: blogId })
      .populate("author", "username avatar firstname lastname slug")
      .populate({
        path: "replies",
        populate: {
          path: "author",
          select: "username avatar firstname lastname",
        },
        options: { sort: { createdAt: 1 } },
      })
      .exec();

    const topLevelComments = await Promise.all(
      comments
        .filter((comment) => !comment.parentComment)
        .map(async (comment) => {
          const commentReplies = await Promise.all(
            comment.replies.map(async (reply) => {
              return {
                ...reply._doc,
                author: {
                  ...reply.author._doc,
                  avatar: reply.author.avatar,
                },
              };
            })
          );

          return {
            ...comment._doc,
            author: {
              ...comment.author._doc,
              avatar: comment.author.avatar,
            },
            replies: commentReplies,
          };
        })
    );
    res.status(200).json(topLevelComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Failed to fetch comments", error });
  }
};
