const mongoose = require("mongoose");
const UserModel = require("../models/User.model");
const CommentModel = require("../models/Comment.model");
const BlogModel = require("../models/Blog.model");
const AnalyticModel = require("../models/Analytic.model");
const useragent = require("express-useragent");

async function updateEngagementScores() {
  const users = await UserModel.find();
  let maxScore = 0;

  const engagementScores = [];

  for (const user of users) {
    const blogs = await BlogModel.find({ author: user._id });

    let likesCount = 0;
    let commentsCount = 0;
    let reportsCount = 0;
    const blogsCount = blogs.length;
    let averageTime = 0;
    let maxViews = 0;
    let totalView = 0;
    let mostViewedBlog;
    let mostReadBlog;
    let mostCommentedBlog;
    let mostLikedBlog;
    let mostReportedBlog;
    let mostSavedBlog;
    let maxReadTime = 0;
    let maxLike = 0;
    let maxComment = 0;
    let maxReport = 0;
    let maxSave = 0;

    if (blogsCount == 0) {
      await AnalyticModel.findOneAndUpdate(
        { user_id: user._id },
        {
          engagementScore: 0,
          likesCount: 0,
          commentsCount: 0,
          reportsCount: 0,
          blogsCount: 0,
          averageTime: 0,
        },
        { upsert: true, new: true }
      );
      continue;
    }

    await Promise.all(
      blogs.map(async (blog) => {
        const [likes, comments, reports] = await Promise.all([
          BlogModel.findById(blog._id).select("likes").lean(),
          CommentModel.countDocuments({ blog: blog._id }),
          BlogModel.findById(blog._id).select("reports").lean(),
        ]);
        const wordsPerMinute = 200;
        if (!blog.markdown) {
          return;
        }
        const wordCount = blog.markdown.split(/\s+/).length;

        const readingTime = Math.ceil(wordCount / wordsPerMinute);

        averageTime += readingTime;

        if (maxReadTime < readingTime) {
          maxReadTime = readingTime;
          mostReadBlog = blog._id;
        }

        if (maxViews < blog.views) {
          maxViews = blog.views;
          mostViewedBlog = blog._id;
        }
        totalView += blog.views.length;
        likesCount += likes?.likes?.length || 0;
        commentsCount += comments || 0;
        reportsCount += reports?.reports?.length || 0;

        if (maxLike < blog.likes.length) {
          maxLike = blog.likes.length;
          mostLikedBlog = blog._id;
        }

        if (maxComment < comments) {
          maxComment = comments;
          mostCommentedBlog = blog._id;
        }

        if (maxReport < reports?.reports?.length) {
          maxReport = reports.length;
          mostReportedBlog = blog._id;
        }

        if (maxSave < blog.saves) {
          maxSave = blog.saves;
          mostSavedBlog = blog._id;
        }
      })
    );

    let engagementScore =
      (likesCount * 2 + commentsCount * 3 - reportsCount * 5 + averageTime) /
      (blogsCount * users.length);

    averageTime = parseFloat(averageTime / blogsCount);

    engagementScores.push({
      userId: user._id,
      averageTime: parseFloat(averageTime),
      rawScore: engagementScore,
      likesCount,
      commentsCount,
      mostViewedBlog,
      totalView,
      reportsCount,
      blogsCount,
      mostReadBlog,
      mostCommentedBlog,
      mostLikedBlog,
      mostReportedBlog,
      mostSavedBlog,
    });
    maxScore = Math.max(maxScore, engagementScore);
  }

  for (const {
    userId,
    averageTime,
    rawScore,
    likesCount,
    commentsCount,
    mostViewedBlog,
    totalView,
    reportsCount,
    blogsCount,
    mostReadBlog,
    mostCommentedBlog,
    mostLikedBlog,
    mostReportedBlog,
    mostSavedBlog,
  } of engagementScores) {
    const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

    await AnalyticModel.findOneAndUpdate(
      { user_id: userId },
      {
        engagementScore: normalizedScore,
        likesCount,
        commentsCount,
        reportsCount,
        mostViewedBlog,
        totalView,
        blogsCount,
        averageTime,
        mostReadBlog,
        mostCommentedBlog,
        mostLikedBlog,
        mostReportedBlog,
        mostSavedBlog,
      },
      { upsert: true, new: true }
    );
  }
  console.log("Engagement scores updated successfully!");
}

async function trackUserAnalytics(userId, country) {
  const currentHour = new Date().getHours().toString().padStart(2, "0");
  const currentDay = new Date().toLocaleString("en-US", { weekday: "long" });

  let analytics = await AnalyticModel.findOne({ user_id: userId });

  if (!analytics) {
    analytics = await AnalyticModel.create({
      user_id: userId,
      locations: [
        {
          country,
          percentage: 100,
          trafficByHour: { [currentHour]: 1 },
          trafficByDay: { [currentDay]: 1 },
        },
      ],
    });
  } else {
    let location = analytics.locations.find((loc) => loc.country === country);

    if (!location) {
      analytics.locations.push({
        country,
        percentage: 1,
        trafficByHour: { [currentHour]: 1 },
        trafficByDay: { [currentDay]: 1 },
      });
    } else {
      location.trafficByHour[currentHour] =
        (location.trafficByHour[currentHour] || 0) + 1;
      location.trafficByDay[currentDay] =
        (location.trafficByDay[currentDay] || 0) + 1;
      location.percentage += 1;
    }

    let totalViews = analytics.locations.reduce(
      (sum, loc) => sum + loc.percentage,
      0
    );
    analytics.locations.forEach((loc) => {
      loc.percentage = ((loc.percentage / totalViews) * 100).toFixed(2);
    });

    await analytics.save();
  }
}

async function getPopularTagsForUser() {
  const users = await UserModel.find();
  for (const user of users) {
    const userId = user._id;
    const result = await BlogModel.aggregate([
      { $match: { author: userId } },
      { $unwind: "$tags" },
      { $group: { _id: null, userTags: { $addToSet: "$tags" } } },

      {
        $lookup: {
          from: "blogs",
          localField: "userTags",
          foreignField: "tags",
          as: "relatedBlogs",
        },
      },

      { $unwind: "$relatedBlogs" },
      { $unwind: "$relatedBlogs.tags" },

      {
        $group: {
          _id: "$relatedBlogs.tags",
          count: { $sum: 1 },
        },
      },

      { $sort: { count: -1 } },

      { $limit: 10 },
    ]);

    await AnalyticModel.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          popularTags: result.map((tag) => ({
            tag: tag._id,
            count: tag.count,
          })),
        },
      },
      { upsert: true, new: true }
    );
  }
}

async function updateDeviceInfo(req, authorId) {
  const user_id = authorId;
  const { browser, os, isMobile, isDesktop } = useragent.parse(
    req.headers["user-agent"]
  );

  let device = "desktop";
  if (isMobile) device = "mobile";
  if (!isMobile && !isDesktop) device = "tablet";

  const browserMap = ["chrome", "safari", "firefox", "edge", "opera"];
  const browserKey = browserMap.includes(browser.toLowerCase())
    ? browser.toLowerCase()
    : "others";

  const osMap = {
    windows: "windows",
    "mac os": "mac",
    "os x": "mac",
    linux: "linux",
    android: "android",
    ios: "ios",
  };
  const osKey = osMap[os.toLowerCase()] || "others";

  const referralSource = await detectReferralSource(req);

  try {
    let updateQuery = {
      $inc: {
        visits: 1,
        [`deviceUsage.${device}`]: 1,
        [`browserUsage.${browserKey}`]: 1,
        [`osUsage.${osKey}`]: 1,
      },
      updatedAt: new Date(),
    };

    if (
      ["google", "bing", "yahoo", "duckduckgo", "baidu"].includes(
        referralSource
      )
    ) {
      updateQuery.$inc[`searchTraffic.${referralSource}`] = 1;
    } else if (
      ["facebook", "twitter", "linkedin", "instagram", "pinterest"].includes(
        referralSource
      )
    ) {
      updateQuery.$inc[`socialTraffic.${referralSource}`] = 1;
    } else {
      updateQuery.$inc[`referralTraffic.${referralSource}`] = 1;
    }

    const analytics = await AnalyticModel.findOneAndUpdate(
      { user_id },
      updateQuery,
      { upsert: true, new: true }
    );

    console.log("Updated Analytics:", analytics);
  } catch (error) {
    console.error("Error updating analytics:", error);
  }
}

async function detectReferralSource(req) {
  const referrer = req.get("Referrer") || "";
  if (!referrer) return "direct";
  if (referrer.includes("google.com")) return "google";
  if (referrer.includes("bing.com")) return "bing";
  if (referrer.includes("yahoo.com")) return "yahoo";
  if (referrer.includes("duckduckgo.com")) return "duckduckgo";
  if (referrer.includes("baidu.com")) return "baidu";

  const socialSources = {
    "facebook.com": "facebook",
    "twitter.com": "twitter",
    "linkedin.com": "linkedin",
    "instagram.com": "instagram",
    "pinterest.com": "pinterest",
  };

  for (const [domain, source] of Object.entries(socialSources)) {
    if (referrer.includes(domain)) return source;
  }

  if (referrer.includes("mail.google.com") || referrer.includes("webmail"))
    return "email";

  const urlParams = new URLSearchParams(req.query);
  if (urlParams.has("utm_source") && urlParams.get("utm_medium") === "cpc")
    return "paid";

  return "others";
}

async function getPopularBlogCategory() {
  const users = await UserModel.find();
  users.forEach(async (user) => {
    const userId = user._id;
    const result = await BlogModel.aggregate([
      { $match: { author: userId } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const popularCategory = result.length > 0 ? result[0]._id : null;

    await AnalyticModel.findOneAndUpdate(
      { user_id: userId },
      {
        $set: { popularBlogCategory: popularCategory },
      },
      { upsert: true, new: true }
    );
  });
}
async function getAnalytics(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;

    const user = await UserModel.findById(userId).lean();

    if (!user) {
      return res.renderWithMainLayout("errors/404.ejs", {
        title: "User Not Found",
        description: "The author you're looking for doesn't exist.",
        keywords: "user not found, author missing, 404 error",
        pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }
    const analytics = await AnalyticModel.findOne({ user_id: userId })
      .populate("mostCommentedBlog")
      .populate("mostLikedBlog")
      .populate("mostReportedBlog")
      .populate("mostSavedBlog")
      .populate("mostViewedBlog")
      .populate("mostReadBlog")
      .lean();
    const recentBlog = await BlogModel.find({ author: userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const featuredBlogs = await BlogModel.aggregate([
      { $match: { featured: true, author: user._id } },
      {
        $addFields: {
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
          likesCount: { $size: { $ifNull: ["$likes", []] } },
        },
      },
      {
        $sort: {
          createdAt: -1,
          commentsCount: -1,
          likesCount: -1,
        },
      },
    ]);

    res.renderWithProfileLayout("../pages/profile/analytic", {
      title: `${user.username}'s Analytics`,
      description: `Explore detailed analytics for ${user.username} on Engineer Insights, including engagement metrics, popular tags, and blog performance.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `analytics, ${user.username}, engagement metrics, popular tags, blog performance, engineer insights`,
      user: { ...user },
      isAuthenticated,
      profile: { ...user },
      readerId: null,
      analytics: { ...analytics, recentBlog: recentBlog[0] },
      featuredBlogs: featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.renderWithMainLayout("errors/500.ejs", {
      title: "Server Error",
      description: "An error occurred while fetching the user's profile.",
      keywords: "server error, 500 error, user profile error",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}
module.exports = {
  updateEngagementScores,
  trackUserAnalytics,
  getPopularTagsForUser,
  updateDeviceInfo,
  detectReferralSource,
  getPopularBlogCategory,
  getAnalytics,
};
