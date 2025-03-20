const express = require("express");
const  { upload, uploadImage }  = require('../middleware/uploadImage.js'); 
const router = express.Router();
const blogController = require("../controllers/blog.controller.js");
const { Auth } = require("../middleware/auth");


router.get("/new", Auth, (req, res) => {
  res.renderWithAuthLayout("../pages/blog/new", {
    title: "Create Blog",
  });
});
router.get("/download/:slug", blogController.downloadBlog);
router.get("/search", blogController.searchBlogs);
router.get("/search/user", blogController.searchUserBlogs);

router.put("/save/:slug",blogController.updateArticleAndRedirect);
router.put("/archive/:slug", blogController.archiveBlog);
router.put("/saveblog/:slug",blogController.limitSavedBlogs, blogController.saveBlog);

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
