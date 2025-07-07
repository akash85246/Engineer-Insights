const { ObjectId } = require("mongoose").Types;
const { cloudinary } = require("../middleware/cloudinary");
const puppeteer = require("puppeteer");
const UserModel = require("../models/User.model");
const BlogModel = require("../models/Blog.model");
const ReportModel = require("../models/Report.model");
const AnalyticModel = require("../models/Analytic.model");
const { createNotification } = require("./notification.controller");
const {
  trackUserAnalytics,
  updateDeviceInfo,
} = require("../controllers/analytic.controller");

async function limitBlogCreate(req, res, next) {
  if (!req.isAuthenticated() || req.user.subscription === "elite") {
    return next();
  }

  const userId = req.user._id;
  const user = await UserModel.findById(userId);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const blogCount = await BlogModel.countDocuments({
    author: userId,
    createdAt: { $gte: startOfMonth },
  });

  const limits = {
    pro: 50,
    regular: 10,
  };

  const userLimit = limits[user.subscription];
  if (blogCount >= userLimit) {
    return res.status(403).json({
      message: `You have reached your monthly limit of ${userLimit} blogs.`,
    });
  }
  next();
}

const saveArticleAndRedirect = (path) => {
  return async (req, res) => {
    const body = req.body;
    const imageUrl = req.body.cloudinaryUrl;
    if (!imageUrl) {
      return res.status(400).json({
        errorMessage: "Please upload an image for the blog",
      });
    }
    const imageId = req.body.cloudinaryId;
    const userId = req.user._id;
    if (body.tags) {
      body.tags = body.tags
        .toLowerCase()
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    let blog = new BlogModel({
      title: body.title,
      description: body.description,
      tags: body.tags,
      author: userId,
      subauthors: body.subauthors ? JSON.parse(body.subauthors) : [],
      allowComments: body["allow-comments"] === "on",
      blogPhoto: imageUrl ? imageUrl : null,
      blogPhotoId: imageId ? imageId : null,
    });

    try {
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { $push: { blogs: blog._id } },
        { new: true, useFindAndModify: false }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const existingBlog = await BlogModel.findOne({ title: body.title });
      if (existingBlog) {
        return res.status(400).json({
          errorMessage:
            "A blog with this title already exists. Please choose a different title.",
        });
      }

      blog = await blog.save();

      const postTime = new Date();
      await AnalyticModel.updateOne(
        { user_id: userId },
        {
          $push: {
            posts: {
              date: postTime,
              count: 1,
            },
          },
        }
      );
      res.redirect(`/blog/edit/${blog.slug}`);
    } catch (e) {
      console.log(e);
      res.json({
        blog: blog,
        errorMessage: "An unexpected error occurred",
      });
    }
  };
};

async function getEditArticleBySlug(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;

    const blog = await BlogModel.findOne({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).render("blog/404");
    }

    const author = await UserModel.findById(blog.author);

    if (author._id.toString() !== userId) {
      const isSubAuthor = author.subauthor && author.subauthor.includes(userId);
      const isAuthor = author._id.toString() === blog.author.toString();

      if (!isSubAuthor && !isAuthor) {
        return res.status(403).send("You are not authorized to edit this blog");
      }
    }

    res.renderWithMainLayout("../pages/blogs/edit", {
      title: "Edit Blog",
      blog: { ...blog._doc, author },
      user: author,
      isAuthenticated,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).send("Internal Server Error");
  }
}

function limitGuestBlogViews(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  if (!req.session.viewedBlogs) {
    req.session.viewedBlogs = 0;
  }

  if (req.session.viewedBlogs >= 10) {
    return res.redirect("/signin");
  }

  req.session.viewedBlogs += 1;
  next();
}

async function getArticleBySlug(req, res, next) {
  try {
    const isAuthenticated = req.isAuthenticated();
    let user = null;
    const defaultSettings = {
      theme: "light",
      notifications: true,
    };

    if (isAuthenticated) {
      user = await UserModel.findById(req.user._id);
    }

    let blog = await BlogModel.findOne({
      slug: req.params.slug,
    })
      .populate({
        path: "subauthors",
        select: "username firstname lastname slug avatar",
      })
      .lean();

    if (!blog) {
      return next();
    }
    if (
      blog.audience != "public" &&
      blog.author.toString() !== user._id.toString()
    ) {
      return res.status(404).json({ message: "Blog not found public" });
    }

    if (isAuthenticated) {
      if (blog.audience === "private") {
        const author = await UserModel.findById(blog.author).lean();
        if (
          author._id.toString() != user._id.toString() &&
          !author.followers
            .map((follower) => follower.toString())
            .includes(user._id.toString())
        ) {
          return res
            .status(403)
            .json({ message: "Access denied: private blog." });
        }
      }
      if (blog.audience === "subscribers") {
        if (
          !user ||
          (user.subscription == "regular" &&
            blog.author.toString() !== user._id.toString())
        ) {
          return res
            .status(403)
            .json({ message: "Access denied: subscriber-only content." });
        }
      }
    } else {
      if (blog.audience != "public") {
        return res
          .status(403)
          .json({ message: "Access denied: private blog." });
      }
    }

    if (user && user.blockedUsers.includes(blog.author.toString())) {
      return res.status(404).json({ message: "Blog not found" });
    }

    if (!user) {
      user = { settings: defaultSettings };
    } else if (!user.settings) {
      user.settings = defaultSettings;
    }

    const author = await UserModel.findById(blog.author).lean();

    if (!author) {
      return res.status(404).json({ error: "Author not found" });
    }

    let canEdit = false;
    let userAlreadyReported = false;
    let userAlreadyLiked = false;
    let userSavedBlog = false;
    let userId = null;

    if (isAuthenticated) {
      try {
        userId = req.user._id;
        const user = await UserModel.findById(userId).select(
          "+blockedUsers +savedBlogs"
        );
        if (userId) {
          canEdit = author._id.toString() === userId;
          if (!canEdit) {
            canEdit = blog.subauthors.some((subauthorId) =>
              subauthorId.equals(new ObjectId(userId))
            );
          }

          userAlreadyReported = blog.reports.some((report) =>
            report.equals(userId)
          );
          userAlreadyLiked = blog.likes.some((like) => like.equals(userId));

          userSavedBlog = user.savedBlogs.some((savedBlogId) =>
            savedBlogId.equals(blog._id)
          );
        }
      } catch (err) {
        console.error("JWT verification failed:", err);
      }
    }

    const createdAt = new Date(blog.createdAt);
    const timeSinceCreation = timeSince(createdAt);
    const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    if (!canEdit) {
      const userCountry = req.headers["x-country"] || "Unknown";
      const author_Id = author._id;
      await trackUserAnalytics(author_Id, userCountry);

      if (userId) {
        await BlogModel.findOneAndUpdate(
          { slug: req.params.slug },
          {
            $addToSet: { views: userId },
          }
        );
      }
      await AnalyticModel.findOneAndUpdate(
        {
          user_id: author_Id,
        },
        {
          $inc: { [`categoryViews.${blog.category}`]: 1 },
          $setOnInsert: { user_id: author_Id },
        },
        { upsert: true, new: true }
      );

      const currentDate = new Date();
      const dateOnly = new Date(currentDate.setHours(0, 0, 0, 0));
      const currentHour = new Date().getHours();
      const existingEntry = await AnalyticModel.findOne({
        user_id: author_Id,
        "engagementTrend.date": dateOnly,
        "engagementTrend.hour": currentHour,
      });

      if (existingEntry) {
        await AnalyticModel.findOneAndUpdate(
          {
            user_id: author_Id,
            "engagementTrend.date": dateOnly,
            "engagementTrend.hour": currentHour,
          },
          {
            $inc: {
              "engagementTrend.$.views": 1,
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
                views: 1,
                likes: 0,
                comments: 0,
                saves: 0,
                reports: 0,
              },
            },
          },
          { new: true, upsert: true }
        );
      }
    }

    await updateDeviceInfo(req, author._id);

    const similarBlogs = await getSimilarBlogs(blog._id, userId);

    res.renderWithMainLayout("../pages/blogs/show", {
      title: blog.title,
      blog: { ...blog, author, timeSinceCreation },
      isAuthenticated,
      editable: canEdit,
      url: fullUrl,
      userAlreadyReported,
      userAlreadyLiked,
      userId: userId,
      userSavedBlog,
      likesCount: blog.likes.length,
      user: user,
      similarBlogs,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval > 1) return `${interval} yr ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} mon ago`;
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} day ago`;
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hr ago`;
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} min ago`;

  return `${Math.floor(seconds)} seconds ago`;
}

async function updateArticleAndRedirect(req, res) {
  try {
    let blog = await BlogModel.findOne({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).send("Article not found");
    }
    blog.markdown = req.body.markdown.trim() || blog.markdown;
    blog.category = req.body.category || blog.category;
    blog.status = req.body.status || blog.status;
    blog.summary = req.body.summaryValue;
    blog.metaTitle = req.body.metaTitle || blog.metaTitle;
    blog.metaDescription = req.body.metaDescription || blog.metaDescription;
    blog.lastModified = Date.now();
    blog.audience = req.body.audience || blog.audience;
    if (blog.markdown == "") {
      blog.status = "draft";
    }
    blog = await blog.save();
    res.status(200).json({ redirectUrl: `/blog/${blog.slug}` });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: error.message });
  }
}

async function likeBlog(req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const blog = await BlogModel.findOne({ slug: req.params.slug });
    const user = req.user;

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const userAlreadyLiked = blog.likes.some((like) => like.equals(user._id));

    if (userAlreadyLiked) {
      blog.likes = blog.likes.filter((like) => !like.equals(user._id));
    } else {
      const notificationData = {
        blogId: blog._id,
        user: blog.author,
        notificationType: "new_like",
        subject: `${user.username} liked your blog`,
        message: `${user.username} liked your blog "${blog.title}"`,
      };

      await createNotification(notificationData);
      blog.likes.push(user._id);

      const currentDate = new Date();
      const dateOnly = new Date(currentDate.setHours(0, 0, 0, 0));
      const currentHour = new Date().getHours();
      const existingEntry = await AnalyticModel.findOne({
        user_id: blog.author,
        "engagementTrend.date": dateOnly,
        "engagementTrend.hour": currentHour,
      });

      if (existingEntry) {
        await AnalyticModel.findOneAndUpdate(
          {
            user_id: blog.author,
            "engagementTrend.date": dateOnly,
            "engagementTrend.hour": currentHour,
          },
          {
            $inc: {
              "engagementTrend.$.likes": 1,
            },
          },
          { new: true }
        );
      } else {
        await AnalyticModel.findOneAndUpdate(
          { user_id: blog.author },
          {
            $push: {
              engagementTrend: {
                date: dateOnly,
                hour: currentHour,
                views: 0,
                likes: 1,
                comments: 0,
                saves: 0,
                reports: 0,
              },
            },
          },
          { new: true, upsert: true }
        );
      }
    }

    await blog.save();

    return res.status(200).json({
      liked: !userAlreadyLiked,
      likesCount: blog.likes.length,
      message: userAlreadyLiked
        ? "You have unliked the blog"
        : "You have liked the blog",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function searchBlogs(req, res) {
  try {
    const {
      tags,
      title,
      author,
      startDate,
      endDate,
      category,
      featured,
      editorspick,
      page = 1,
      search,
      limit = 10,
    } = req.query;

    let userId = null;
    let user = null;
    if (req.isAuthenticated()) {
      user = req.user;
      userId = user._id;
    }

    const searchCriteria = { status: "published" };

    if (user && user.subscription && user.subscription === "regular") {
      searchCriteria.audience = "public";
    }

    if (user && user.blockedUsers.length > 0) {
      searchCriteria.author = { $nin: user.blockedUsers };
    }

    if (author) {
      const authorArray = author.split(",").map((auth) => auth.trim());
      searchCriteria.author = { $in: authorArray };
    }

    if (tags) {
      searchCriteria.tags = { $in: tags.split(",") };
    }

    if (title) {
      searchCriteria.title = { $regex: new RegExp(title, "i") };
    }

    if (search) {
      searchCriteria.$or = [
        { title: { $regex: new RegExp(search, "i") } },
        { tags: { $in: search.split(",") } },
      ];
    }

    if (startDate || endDate) {
      searchCriteria.createdAt = {};
      if (startDate) {
        searchCriteria.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        searchCriteria.createdAt.$lte = new Date(endDate);
      }
    }

    if (category) {
      searchCriteria.category = category;
    }

    if (featured !== undefined) {
     
      searchCriteria.featured = featured;
    }

    if (editorspick) {
      searchCriteria.editorspick = editorspick === "true";
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const blogs = await BlogModel.find(searchCriteria)
      .populate(
        "author",
        "username avatar firstname lastname slug followers subscription"
      )
      .sort({ createdAt: -1, likes: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const refinedBlogs = await Promise.all(
      blogs.map(async (blog) => {
        if (blog.audience === "public") {
          return blog;
        } else if (blog.audience === "private") {
          const isFollower =
            blog.author.followers &&
            blog.author.followers
              .map((follower) => follower.toString())
              .includes(user._id.toString());
          if (isFollower) {
            return blog;
          }
        } else if (blog.audience === "subscribers") {
          const isEligibleSubscriber =
            user &&
            (user.subscription === "pro" ||
              user.subscription === "elite" ||
              blog.author._id.toString() === user._id.toString());
          if (isEligibleSubscriber) {
            return blog;
          }
        }
        return null;
      })
    );
    const finalRefinedBlogs = refinedBlogs.filter((blog) => blog !== null);

    const totalBlogs = await BlogModel.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalBlogs / parseInt(limit, 10));

    return res.status(200).json({
      message: "Blogs fetched successfully",
      blogs: finalRefinedBlogs,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalBlogs,
        pageSize: parseInt(limit, 10),
      },
    });
  } catch (error) {
    console.error("Error searching blogs:", error);
    return res.status(500).json({
      message: "Error searching blogs",
      error: error.message,
    });
  }
}

async function searchUserBlogs(req, res) {
  try {
    const {
      tags,
      title,
      author,
      startDate,
      endDate,
      category,
      featured,
      status,
      editorspick,
      page = 1,
      search,
      limit = 10,
    } = req.query;

    let userId = null;
    const isAuthenticated = req.isAuthenticated();
    if (isAuthenticated) {
      userId = req.user._id;
    }

    const searchCriteria = {};

    if (status) {
      searchCriteria.status = status;
    }

    if (author && status !== "draft") {
      const authorArray = author.split(",").map((auth) => auth.trim());
      searchCriteria.author = { $in: authorArray };
    }

    if (tags) {
      searchCriteria.tags = { $in: tags.split(",") };
    }

    if (title) {
      searchCriteria.title = { $regex: new RegExp(title, "i") };
    }

    if (search) {
      searchCriteria.$or = [
        { title: { $regex: new RegExp(search, "i") } },
        { tags: { $in: search.split(",") } },
      ];
    }

    if (startDate || endDate) {
      searchCriteria.createdAt = {};
      if (startDate) {
        searchCriteria.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        searchCriteria.createdAt.$lte = new Date(endDate);
      }
    }

    if (category) {
      searchCriteria.category = category;
    }

    if (featured) {
      searchCriteria.featured = featured === "true";
    }

    if (editorspick) {
      searchCriteria.editorspick = editorspick === "true";
    }

    if (status === "draft" && isAuthenticated) {
      searchCriteria.status = "draft";

      const authorArray = author?.split(",").map((auth) => auth.trim()) || [];

     
      searchCriteria.$or = [
        { author: { $in: authorArray } },
        { subauthors: { $in: [userId] } },
      ];
    }
 

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const blogs = await BlogModel.find(searchCriteria)
      .populate("author", "username avatar firstname lastname slug")
      .sort({ likes: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalBlogs = await BlogModel.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalBlogs / parseInt(limit, 10));

    return res.status(200).json({
      message: "Blogs fetched successfully",
      blogs: blogs,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalBlogs,
        pageSize: parseInt(limit, 10),
      },
    });
  } catch (error) {
    console.error("Error searching blogs:", error);
    return res.status(500).json({
      message: "Error searching blogs",
      error: error.message,
    });
  }
}

async function getAllBlogs(req, res) {
  try {
    let user = null;
    const defaultSettings = {
      theme: "light",
      notifications: true,
    };
    const tags = req.params.tags || "";
    const isAuthenticated = req.isAuthenticated();
    if (req.isAuthenticated()) {
      user = await UserModel.findById(req.user._id);
    }
    if (!user) {
      user = { settings: defaultSettings };
    } else if (!user.settings) {
      user.settings = defaultSettings;
    }
    res.renderWithMainLayout("../pages/blogs/all", {
      title: "All Blogs",
      tags,
      isAuthenticated,
      user: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error", error);
  }
}

async function archiveBlog(req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in first" });
    }

    const user = req.user;
    const blog = await BlogModel.findOne({ slug: req.params.slug });

    if (!blog) {
      return res.status(404).json({ message: "Article not found" });
    }

    if (!blog.author.equals(user._id)) {
      return res.status(401).json({ message: "User not authorized" });
    }
    const blogAlreadyArchived = blog.status === "archived";

    if (blogAlreadyArchived) {
      blog.status = "published";
      await blog.save();
      return res
        .status(200)
        .json({ archived: false, message: "You have published the article" });
    } else {
      blog.status = "archived";
      await blog.save();
      return res
        .status(200)
        .json({ archived: true, message: "You have archived the article" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function limitSavedBlogs(req, res, next) {
  const slug = req.params.slug;

  if (!req.isAuthenticated() || req.user.subscription === "elite") {
    return next();
  }
  const blog = await BlogModel.findOne({ slug: req.params.slug });
  const userId = req.user._id;
  const user = await UserModel.findById(userId).populate("savedBlogs");

  if (
    user.savedBlogs.some(
      (savedBlog) => savedBlog._id.toString() === blog._id.toString()
    )
  ) {
    return next();
  }
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Count saved blogs from the current month
  const savedThisMonth = user.savedBlogs.filter(
    (blog) => blog.createdAt >= startOfMonth && blog.status == "published"
  ).length;

  // Define limits based on subscription type
  const limits = {
    pro: 50,
    regular: 10,
  };

  const userLimit = limits[user.subscription];

  if (savedThisMonth >= userLimit) {
    return res.status(403).json({
      message: `You have reached your monthly limit of ${userLimit} saved blogs.`,
    });
  }

  next();
}

async function saveBlog(req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const blog = await BlogModel.findOne({ slug: req.params.slug });
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const userSavedBlogs = user.savedBlogs.some((saved) =>
      saved.equals(blog._id)
    );

    if (userSavedBlogs) {
      user.savedBlogs = user.savedBlogs.filter(
        (saved) => !saved.equals(blog._id)
      );
      if (blog.saves > 0) {
        blog.saves -= 1;
        await blog.save();
      }
      await user.save();
      return res
        .status(200)
        .json({ saved: false, message: "You have unsaved the blog" });
    } else {
      user.savedBlogs.push(blog._id);
      blog.saves += 1;
      await blog.save();
      await user.save();

      const currentDate = new Date();
      const dateOnly = new Date(currentDate.setHours(0, 0, 0, 0));
      const currentHour = new Date().getHours();
      const existingEntry = await AnalyticModel.findOne({
        user_id: blog.author,
        "engagementTrend.date": dateOnly,
        "engagementTrend.hour": currentHour,
      });

      if (existingEntry) {
        await AnalyticModel.findOneAndUpdate(
          {
            user_id: blog.author,
            "engagementTrend.date": dateOnly,
            "engagementTrend.hour": currentHour,
          },
          {
            $inc: {
              "engagementTrend.$.saves": 1,
            },
          },
          { new: true }
        );
      } else {
        await AnalyticModel.findOneAndUpdate(
          { user_id: blog.author },
          {
            $push: {
              engagementTrend: {
                date: dateOnly,
                hour: currentHour,
                views: 0,
                likes: 0,
                comments: 0,
                saves: 1,
                reports: 0,
              },
            },
          },
          { new: true, upsert: true }
        );
      }
      return res
        .status(200)
        .json({ saved: true, message: "You have saved the blog" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error", error: e });
  }
}

async function deleteBlog(req, res) {
  const isAuthenticated = req.isAuthenticated();

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized, no token provided" });
  }

  const userId = req.user._id;

  try {
    const user = await UserModel.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const slug = req.params.slug;
    const blog = await BlogModel.findOne({ slug: req.params.slug }).lean();

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    if (blog.author.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized: You are not the author of this blog" });
    }

    await ReportModel.deleteMany({ blogId: blog._id });

    await UserModel.updateMany(
      { _id: userId },
      {
        $pull: { blogs: blog._id, savedBlogs: blog._id },
      }
    );

    await UserModel.updateMany(
      { savedBlogs: blog._id },
      {
        $pull: { savedBlogs: blog._id },
      }
    );

    await cloudinary.uploader.destroy(blog.blogPhotoId);

    const deleteResult = await BlogModel.deleteOne({ slug, author: userId });
    if (deleteResult.deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "Blog not found or not authorized" });
    }

    res
      .status(200)
      .json({ message: "Blog and related reports deleted successfully" });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
}

async function downloadBlog(req, res) {
  try {
    const slug = req.params.slug;
    const blogUrl = `${req.protocol}://${req.get("host")}/blog/${slug}`;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(blogUrl, { waitUntil: "networkidle2", timeout: 60000 });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              })
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 5000));
    });
    const pdfBuffer = await page.pdf({
      format: "A2",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="EngineerInsights_${slug}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);

    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}

//function to get the popular blogs
async function getPopularBlogs(userId) {
  try {
    const blogs = await BlogModel.aggregate([
      {
        $match: {
          status: "published",
          author: { $ne: userId },
          subAuthors: { $nin: [userId] },
        },
      },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          viewsCount: { $ifNull: ["$views", 0] },
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
        },
      },
      {
        $sort: {
          likesCount: -1,
          viewsCount: -1,
          commentsCount: -1,
        },
      },
      {
        $group: {
          _id: "$category",
          blogs: { $push: "$$ROOT" },
        },
      },
      { $unwind: "$blogs" },
      { $replaceRoot: { newRoot: "$blogs" } },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      {
        $project: {
          title: 1,
          category: 1,
          createdAt: 1,
          likes: 1,
          views: 1,
          comments: 1,
          "author.username": 1,
          "author.avatar": 1,
          "author.firstname": 1,
          "author.lastname": 1,
          "author.slug": 1,
          "author.blockedUsers": 1,
        },
      },
    ]);

    var filteredBlogs = await filterBlogsByBlockedUsers(blogs, userId);
    filteredBlogs = await filterBlogsByAudience(filteredBlogs, userId);
    filteredBlogs = await filterBlogsByStatus(filteredBlogs, userId);

    const grouped = {};
    const blogsToGroup = Array.isArray(filteredBlogs) ? filteredBlogs : [];

    for (const blog of blogsToGroup) {
      const category = blog.category?.toString() || "uncategorized";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      if (grouped[category].length < 8) {
        grouped[category].push(blog);
      }
    }

    filteredBlogs = Object.values(grouped).flat();

    return filteredBlogs;
  } catch (error) {
    console.error("Error fetching popular blogs:", error);
  }
}

//function to get the latest blogs
async function getLatestBlogs(userId) {
  try {
    const user = await UserModel.findById(userId).select("+blockedUsers");

    const blogs = await BlogModel.find({
      author: { $ne: userId },
      subAuthors: { $nin: [userId] },
    })
      .sort({ createdAt: -1 })
      .populate(
        "author",
        "username avatar firstname lastname slug  blockedUsers"
      )
      .lean();

    var filteredBlogs = (await filterBlogsByBlockedUsers(blogs, user)) || [];
    filteredBlogs = (await filterBlogsByAudience(filteredBlogs, user)) || [];
    filteredBlogs = (await filterBlogsByStatus(filteredBlogs, user)) || [];
    filteredBlogs = filteredBlogs.slice(0, 8);

    return filteredBlogs;
  } catch (error) {
    console.error("Error fetching latest blogs:", error);
    throw error;
  }
}

//function to get the favourite author blogs
async function getFavouriteAuthorBlogs(userId) {
  if (!userId) {
    return [];
  }

  const user = await UserModel.findById(userId).select("+following");
  const blogs = await BlogModel.find({
    author: { $in: user.following },
    status: "published",
  })
    .sort({ createdAt: -1 })
    .populate(
      "author",
      "username avatar firstname lastname slug  blockedUsers "
    )
    .lean();

  var filteredBlogs = (await filterBlogsByBlockedUsers(blogs, user)) || [];
  filteredBlogs = (await filterBlogsByAudience(filteredBlogs, user)) || [];
  filteredBlogs = (await filterBlogsByStatus(filteredBlogs, user)) || [];
  filteredBlogs = filteredBlogs.slice(0, 20);
  return filteredBlogs;
}

//function to get the featured blogs
async function getFeaturedBlogs(userId) {
  const blogs = await BlogModel.find({
    status: "published",
    featured: true,
    author: { $ne: userId },
    subAuthors: { $nin: [userId] },
  })
    .sort({ createdAt: -1 })
    .populate("author", "username avatar firstname lastname slug  blockedUsers")
    .lean();

  var filteredBlogs = (await filterBlogsByBlockedUsers(blogs, userId)) || [];
  filteredBlogs = (await filterBlogsByAudience(filteredBlogs, userId)) || [];
  filteredBlogs = (await filterBlogsByStatus(filteredBlogs, userId)) || [];

  filteredBlogs = filteredBlogs.slice(0, 10);
  return filteredBlogs;
}

//function to get the editorial blogs
async function getEditorialBlogs(userId) {
  const now = new Date();

  const blogs = await BlogModel.find({ status: "published" })
    .populate(
      "author",
      "followers username avatar firstname lastname slug blockedUsers"
    )
    .sort({ createdAt: -1 })
    .lean();

  const scoredBlogs = blogs
    .map((blog) => {
      const createdAt = new Date(blog.createdAt);
      const ageInMs = now - createdAt;
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

      const score =
        (blog.likes || 0) * 3 +
        (blog.commentsCount || 0) * 2 +
        (blog.views || 0) -
        ageInDays * 0.5 +
        ((blog.author?.followers || 0) > 1000 ? 10 : 0);
      return { ...blog, editorialScore: score };
    })
    .sort((a, b) => b.editorialScore - a.editorialScore);

  var filteredBlogs =
    (await filterBlogsByBlockedUsers(scoredBlogs, userId)) || [];
  filteredBlogs = (await filterBlogsByAudience(filteredBlogs, userId)) || [];
  filteredBlogs = (await filterBlogsByStatus(filteredBlogs, userId)) || [];
  filteredBlogs = filteredBlogs.slice(0, 6);
 
  return filteredBlogs;
}

//function to filter blogs by blocked users
async function filterBlogsByBlockedUsers(blogs, user) {
  if (!user) return blogs;

  const userBlocked = user.blockedUsers?.map((id) => id.toString()) || [];

  let filteredBlogs = blogs.filter((blog) => {
    const authorId = blog.author?._id?.toString() || blog.author?.toString();
    return authorId && !userBlocked.includes(authorId);
  });

  filteredBlogs = filteredBlogs.filter((blog) => {
    const authorBlockedUsers =
      blog.author?.blockedUsers?.map((id) => id.toString()) || [];
    return !authorBlockedUsers.includes(user._id.toString());
  });

  return filteredBlogs;
}
//function to filter blogs by audience
async function filterBlogsByAudience(blogs, user) {
  if (!user) return blogs;
  var filteredBlogs = blogs.filter((blog) => {
    if (blog.audience === "public") {
      return true;
    } else if (blog.audience === "private") {
      return (
        user.followers.includes(blog.author.toString()) ||
        blog.author === user._id ||
        blog.subauthors.includes(user._id)
      );
    } else if (blog.audience === "subscribers") {
      return (
        user.subscription !== "regular" ||
        blog.author === user._id ||
        blog.subauthors.includes(user._id)
      );
    }
    return false;
  });
  return filteredBlogs;
}
//function to filter blogs by status
async function filterBlogsByStatus(blogs, user) {
  if (!user) return blogs;
  var filteredBlogs = blogs.filter((blog) => {
    if (blog.status === "published") {
      return true;
    } else if (blog.status === "draft") {
      return blog.author.toString() === user || blog.subauthors.includes(user);
    } else if (blog.status === "archived") {
      return blog.author.toString() === user || blog.subauthors.includes(user);
    }
    return false;
  });

  return filteredBlogs;
}

//
async function getSimilarBlogs(blogId, userId) {
  if (!userId) {
    return [];
  }
  try {
    const blog = await BlogModel.findById(blogId).select(
      "category tags author subauthors"
    );

    const similarBlogs = await BlogModel.find({
      category: blog.category,
      _id: { $ne: blog._id },
      status: "published",
      author: { $ne: userId },
      subAuthors: { $nin: [userId] },
      tags: { $in: blog.tags },
    })
      .populate(
        "author",
        "username avatar firstname lastname slug blockedUsers"
      )
      .sort({ createdAt: -1 })
      .lean();

    var filteredBlogs =
      (await filterBlogsByBlockedUsers(similarBlogs, userId)) || [];
    filteredBlogs = (await filterBlogsByAudience(filteredBlogs, userId)) || [];
    filteredBlogs = (await filterBlogsByStatus(filteredBlogs, userId)) || [];
    filteredBlogs = filteredBlogs.slice(0, 20);

    return filteredBlogs;
  } catch (error) {
    console.error("Error fetching similar blogs:", error);
    return error;
  }
}

module.exports = {
  limitBlogCreate,
  saveArticleAndRedirect,
  limitGuestBlogViews,
  getArticleBySlug,
  getEditArticleBySlug,
  updateArticleAndRedirect,
  getAllBlogs,
  likeBlog,
  searchBlogs,
  searchUserBlogs,
  archiveBlog,
  limitSavedBlogs,
  saveBlog,
  deleteBlog,
  downloadBlog,
  getPopularBlogs,
  getLatestBlogs,
  getFeaturedBlogs,
  getEditorialBlogs,
  getFavouriteAuthorBlogs,
};
