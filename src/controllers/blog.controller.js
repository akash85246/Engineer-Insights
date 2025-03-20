const { ObjectId } = require("mongoose").Types;
const { cloudinary } = require("../middleware/cloudinary");
const puppeteer = require("puppeteer");
const UserModel = require("../models/User.model");
const BlogModel = require("../models/Blog.model");
const ReportModel = require("../models/Report.model");
const AnalyticModel = require("../models/Analytic.model");
const { createNotification } = require("./notification.controller");
const { trackUserAnalytics,updateDeviceInfo } = require("../controllers/analytic.controller");


async function limitBlogCreate(req, res, next) {
  if (!req.isAuthenticated() || req.user.subscription === "elite") {
    console.log("i am out");
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
  console.log("i am our");
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
      body.tags = body.tags.toLowerCase()
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
          console.log("author", author._id, user._id);
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
            console.log("can edit", canEdit);
          }
          console.log("can edit", canEdit);
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

      await BlogModel.findOneAndUpdate(
        { slug: req.params.slug },
        { $inc: { views: 1 } }
      );

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
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval > 1) return `${interval} years ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;

  return `${Math.floor(seconds)} seconds ago`;
}

async function updateArticleAndRedirect(req, res) {
  try {
    let blog = await BlogModel.findOne({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).send("Article not found");
    }
    console.log("summary", blog.summary, req.body.summaryValue);
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
          { user_id: author_Id },
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
      console.log("featured", featured);
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

    let userId = author;

    const searchCriteria = {};

    if (status) {
      searchCriteria.status = status;
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

    if (featured) {
      searchCriteria.featured = featured === "true";
    }

    if (editorspick) {
      searchCriteria.editorspick = editorspick === "true";
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
  console.log("slug", slug);

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

    console.log("Deleting image with public_id:", blog.blogPhotoId);
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
};
