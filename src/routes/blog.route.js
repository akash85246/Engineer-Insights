const express = require("express");
const { upload, uploadImage } = require("../middleware/uploadImage.js");
const router = express.Router();
const blogController = require("../controllers/blog.controller.js");
const { Auth } = require("../middleware/auth");

router.get("/new", Auth, (req, res) => {
  res.renderWithAuthLayout("../pages/blog/new", {
    title: "Create Blog",
    description:
      "Create a new blog post on Engineer Insights, the platform for engineers to share knowledge and insights.",
    pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    keywords: "create blog, new post, engineer insights, write article",
    user: req.user,
    isAuthenticated: req.isAuthenticated,
  });
});
router.get("/download/:slug", blogController.downloadBlog);
router.get("/search", blogController.searchBlogs);
router.get("/search/user", blogController.searchUserBlogs);

router.put("/save/:slug", blogController.updateArticleAndRedirect);
router.put("/archive/:slug", blogController.archiveBlog);
router.put(
  "/saveblog/:slug",
  blogController.limitSavedBlogs,
  blogController.saveBlog
);

router.post(
  "/new",
  blogController.limitBlogCreate,
  upload.single("blogPhoto"),
  uploadImage,
  blogController.saveArticleAndRedirect("new")
);
router.put("/like/:slug", blogController.likeBlog);

router.delete("/delete/:slug", blogController.deleteBlog);

module.exports = router;
