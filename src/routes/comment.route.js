const express = require("express");
const router = express.Router();
const commentController = require("../controllers/comment.controller");

router.get("/:blogId", commentController.getCommentsByBlog);

router.post("/like/:commentId", commentController.toggleLikeComment);

router.delete("/delete/:commentId", commentController.deleteComment);


module.exports = router;
