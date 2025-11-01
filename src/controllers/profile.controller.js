const mongoose = require("mongoose");
const { Types } = mongoose;
const UserModel = require("../models/User.model");
const CommentModel = require("../models/Comment.model");
const BlogModel = require("../models/Blog.model");
const NotificationModel = require("../models/Notification.model");
const { fetchUserAnalytics } = require("../services/analytics");

const ReportModel = require("../models/Report.model");
const { comment } = require("postcss");

async function getProfile(req, res, next) {
  try {
    const slug = req.params.slug;

    const defaultSettings = {
      theme: "light",
      notifications: false,
    };

    const profile = await UserModel.findOne({ slug: slug });

    let user = null;
    let isAuthenticated = req.isAuthenticated();
    if (req.isAuthenticated()) {
      user = await UserModel.findById(req.user._id);
    }
    if (!user) {
      user = { settings: defaultSettings };
    }

    const featuredBlogs = await BlogModel.aggregate([
      { $match: { featured: true, author: profile._id } },
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

    res.renderWithProfileLayout("../pages/profile/profile", {
      title: `${profile.username}'s Profile`,
      description: `Explore the profile of ${profile.username} on Engineer Insights. Discover their blogs, insights, and contributions to the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `profile, ${profile.username}, engineer insights, user profile`,
      profile,
      user,
      isAuthenticated,
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return next();
  }
}

async function getUpdateProfile(req, res) {
  try {
    console.log("req.isAuthenticated()", req.isAuthenticated());
    if (!req.isAuthenticated()) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId).lean();
    const isAuthenticated = req.isAuthenticated();

    res.renderWithProfileLayout("../pages/profile/editProfile", {
      title: "Edit Profile",
      description: `Edit your profile on Engineer Insights. Update your personal information, avatar, and preferences to enhance your experience on the platform.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "edit profile, update user info, engineer insights, profile settings",
      user: user,
      profile: { ...user },
      isAuthenticated,
      featuredBlogs: false,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).send("An error occurred while fetching the profile.");
  }
}

async function updateProfile(req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication token is missing" });
    }
    const userId = req.user._id;

    const body = { ...req.body };
    console.log(body);

    if (body.tags) {
      body.tags = body.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    if (req.file) {
      const imageUrl = req.body.cloudinaryUrl;
      const imageId = req.body.cloudinaryId;
      body.avatar = imageUrl;
      body.avatarId = imageId;

      const result = await UserModel.findOneAndUpdate({ _id: userId }, body, {
        new: true,
        runValidators: true,
      });

      if (result) {
        req.user = result.toObject();
        return res
          .status(200)
          .json({
            message: "Profile updated successfully",
            slug: req.user.slug,
          });
      } else {
        return res.status(404).json({ message: "No record found to update" });
      }
    } else {
      const result = await UserModel.findOneAndUpdate({ _id: userId }, body, {
        new: true,
        runValidators: true,
      });

      if (result) {
        req.user = result.toObject();
        return res
          .status(200)
          .json({
            message: "Profile updated successfully",
            slug: req.user.slug,
          });
      } else {
        return res.status(404).json({ message: "No record found to update" });
      }
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal Server Error" });
  }
}

async function checkUsernameAvailability(req, res) {
  try {
    const username = req.params.username;
    console.log("Checking availability for username:", username);
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    let loginUser = null;
    const isAuthenticated = req.isAuthenticated();
    if (isAuthenticated) {
      const userId = req.user._id;
      loginUser = await UserModel.findById(userId).lean();
    }

    let user = await UserModel.findOne({ username: username });
    if (isAuthenticated && username == loginUser.username) {
      return res.status(200).json({ available: true });
    }

    if (user) {
      return res.status(200).json({ available: false });
    } else {
      return res.status(200).json({ available: true });
    }
  } catch (error) {
    console.error("Error checking username availability:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
}

async function searchProfile(req, res) {
  const { tags, id, username } = req.query;

  console.log("Search query:", id, tags, username);
  if (!tags && !id && !username) {
    return res.status(200).json({ message: "No search criteria provided" });
  }

  const tagArray = tags
    ? tags.split(",").map((tag) => tag.trim().toLowerCase())
    : [];

  try {
    const matchCriteria = {};

    if (tagArray.length > 0) {
      matchCriteria.matchedTagsCount = { $gt: 0 };
    }

    if (id && Types.ObjectId.isValid(id)) {
      // matchCriteria.id = { $regex: new RegExp(id, "i") };
      matchCriteria._id = { $ne: new mongoose.Types.ObjectId(id) };
    }
    if (username) {
      matchCriteria.username = { $regex: new RegExp(username, "i") };
    }
    let users;

    // if (tags !== undefined) {
      users = await UserModel.aggregate([
        {
          $addFields: {
            matchedTagsCount: {
              $size: {
                $filter: {
                  input: {
                    $map: {
                      input: "$tags",
                      as: "tag",
                      in: { $toLower: "$$tag" },
                    },
                  },
                  as: "tag",
                  cond: { $in: ["$$tag", tagArray] },
                },
              },
            },
          },
        },
        {
          $match: matchCriteria,
        },
        {
          $sort: { matchedTagsCount: -1 },
        },
        {
          $project: {
            username: 1,
            email: 1,
            tags: 1,
            matchedTagsCount: 1,
            firstname: 1,
            lastname: 1,
            avatar: 1,
            bio: 1,
            slug: 1,
          },
        },
      ]);
    // } else {

    //   const users = await UserModel.find(matchCriteria)
    //     .select("username email tags firstname lastname avatar bio slug")
    //     .lean();
     // }
      res.json(users);
   
  } catch (err) {
    console.error("Error in searchProfile:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
}

async function getAuthorBySlug(req, res) {
  try {
    const slug = req.params.slug;
    let readerId = null;
    let blocked = false;
    let reader = null;
    const defaultSettings = {
      theme: "light",
      notifications: false,
    };

    if (req.isAuthenticated()) {
      readerId = req.user._id;

      reader = await UserModel.findById(readerId);
    }

    const user = await UserModel.findOne({ slug: slug })
      .lean()
      .populate(
        "blogs",
        "tags editorspick featured category blogPhoto title description"
      );

    if (!reader) {
      reader = { settings: defaultSettings, blockedUsers: [] };
    } else {
      if (!reader.settings) {
        reader.settings = defaultSettings;
      }
      if (!reader.blockedUsers) {
        reader.blockedUsers = [];
      }
    }

    if (reader.blockedUsers.includes(user._id)) {
      blocked = true;
      return res.status(404).json({ message: "Not found" });
    }

    if (!user) {
      return res.status(404).render("errors/404.ejs", {
        title: "User Not Found",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated: req.isAuthenticated(),
      });
    }

    let followed = false;
    if (user.followers.some((follower) => follower.toString() === readerId)) {
      followed = true;
    }

    res.renderWithMainLayout("../pages/profile/author.ejs", {
      title: `${user.username}'s Profile`,
      description: `Explore the profile of ${user.username} on Engineer Insights. Discover their blogs, insights, and contributions to the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `profile, ${user.username}, engineer insights, user profile`,
      user: reader,
      reader: { ...user, blogs: user.blogs },
      isAuthenticated: req.isAuthenticated(),
      readerId,
      blocked,
      followed,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("errors/500.ejs", {
      title: "Server Error",
      message: "There was an issue fetching the author's profile.",
    });
  }
}

async function getAuthorDrafts(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();

    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const user = await UserModel.findById(req.user._id).lean();

    if (!user) {
      return res.renderWithMainLayout("errors/404.ejs", {
        title: "User Not Found",
        description: "The author you're looking for doesn't exist.",
        pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        keywords: "user not found, profile error, engineer insights",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

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

    res.renderWithProfileLayout("../pages/profile/draft", {
      title: `${user.username}'s Drafts`,
      description: `Explore the drafts of ${user.username} on Engineer Insights. Review and manage your unpublished blog posts and articles.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `drafts, ${user.username}, engineer insights, unpublished blogs`,
      user: { ...user },
      isAuthenticated,
      profile: { ...user },
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).render("errors/500.ejs", {
      title: "Server Error",
      message: "An error occurred while fetching the user's profile.",
    });
  }
}

async function savedBlogs(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId)
      .populate(
        "savedBlogs",
        "author title description blogPhoto tags createdAt slug"
      )
      .lean();

    if (!user) {
      return res.renderWithMainLayout("errors/404.ejs", {
        title: "User Not Found",
        description: "The author you're looking for doesn't exist.",
        pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        keywords: "user not found, profile error, engineer insights",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

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

    res.renderWithProfileLayout("../pages/profile/saved", {
      title: `${user.username}'s Saved Blogs`,
      description: `Explore the saved blogs of ${user.username} on Engineer Insights. Access and read your favorite articles and posts.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `saved blogs, ${user.username}, engineer insights, favorite articles`,
      profile: { ...user },
      user,
      isAuthenticated,
      featuredBlogs,
    });
  } catch (error) {
    // console.error("Error fetching user:", error);
    res.renderWithMainLayout("errors/500.ejs", {
      title: "Server Error",
      description: "An error occurred while fetching the user's profile.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "server error, profile error, engineer insights",
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}

async function getSavedBlogs(req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    const { page = 1, limit = 10 } = req.query;

    const userId = req.user._id;
    const user = await UserModel.findById(userId)
      .populate({
        path: "savedBlogs",
        select:
          "author title description blogPhoto tags createdAt slug subauthors likes",
        populate: {
          path: "author",
          select: "username firstname lastname  avatar slug",
        },
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "The author you're looking for doesn't exist.",
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const totalBlogs = user.savedBlogs.length;

    const paginatedBlogs = user.savedBlogs.slice(startIndex, endIndex);

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalBlogs,
      totalPages: Math.ceil(totalBlogs / limit),
      savedBlogs: paginatedBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching the user's profile.",
    });
  }
}

async function getArchivedBlogs(req, res) {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    return res.redirect("/signin");
  }

  const user = await UserModel.findById(req.user._id).lean();

  if (!user) {
    return res.renderWithMainLayout("errors/404.ejs", {
      title: "User Not Found",
      description: "The author you're looking for doesn't exist.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "user not found, profile error, engineer insights",
      message: "The author you're looking for doesn't exist.",
      isAuthenticated,
    });
  }

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

  res.renderWithProfileLayout("../pages/profile/archived", {
    title: `${user.username}'s Archieve`,
    description: `Explore the archived blogs of ${user.username} on Engineer Insights. Review and manage your archived blog posts and articles.`,
    pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    keywords: `archived blogs, ${user.username}, engineer insights, old articles`,
    user: { ...user },
    isAuthenticated,
    profile: { ...user },
    featuredBlogs,
  });
}

async function getUserReports(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const user = await UserModel.findById(req.user._id).lean();

    if (!user) {
      return res.renderWithMainLayout("errors/404.ejs", {
        title: "User Not Found",
        description: "The author you're looking for doesn't exist.",
        pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        keywords: "user not found, profile error, engineer insights",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

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

    res.renderWithProfileLayout("../pages/profile/report", {
      title: `${user.username}'s Reports`,
      description: `Explore the reports made by ${user.username} on Engineer Insights. Review and manage your reported content and submissions.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `reports, ${user.username}, engineer insights, reported content`,
      user: { ...user },
      isAuthenticated,
      profile: { ...user },
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.renderWithMainLayout("errors/500.ejs", {
      title: "Server Error",
      description: "An error occurred while fetching the user's profile.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "server error, profile error, engineer insights",
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}

async function getUserFollowers(req, res) {
  try {
    const slug = req.params.slug;

    const defaultSettings = {
      theme: "light",
      notifications: false,
    };

    let user = { settings: defaultSettings };
    const isAuthenticated = req.isAuthenticated();
    if (isAuthenticated) {
      user = await UserModel.findById(req.user._id);
    }

    const profile = await UserModel.findOne({ slug: slug });

    const featuredBlogs = await BlogModel.aggregate([
      { $match: { featured: true, author: profile._id } },
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

    res.renderWithProfileLayout("../pages/profile/follower", {
      title: `${profile.username}'s Followers`,
      description: `Explore the followers of ${profile.username} on Engineer Insights. See who is following their blogs and contributions to the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `followers, ${profile.username}, engineer insights, user followers`,
      user,
      isAuthenticated,
      profile,
      readerId: null,
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.renderWithMainLayout("errors/500.ejs", {
      title: "Server Error",
      description: "An error occurred while fetching the user's profile.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "server error, profile error, engineer insights",
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}

async function getUserFollowing(req, res) {
  try {
    const slug = req.params.slug;

    const defaultSettings = {
      theme: "light",
      notifications: false,
    };

    let user = { settings: defaultSettings };
    const isAuthenticated = req.isAuthenticated();
    if (isAuthenticated) {
      user = await UserModel.findById(req.user._id);
    }
    const profile = await UserModel.findOne({ slug: slug });

    const featuredBlogs = await BlogModel.aggregate([
      { $match: { featured: true, author: profile._id } },
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

    res.renderWithProfileLayout("../pages/profile/following", {
      title: `${profile.username}'s Following`,
      description: `Explore who ${profile.username} is following on Engineer Insights. Discover the authors and blogs they are interested in within the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `following, ${profile.username}, engineer insights, user following`,
      user,
      readerId: null,
      isAuthenticated,
      profile,
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.renderWithMainLayout("errors/500.ejs", {
      title: "Server Error",
      description: "An error occurred while fetching the user's profile.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "server error, profile error, engineer insights",
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}

async function getUserNotification(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();

    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const user = await UserModel.findById(req.user._id).lean();

    if (!user) {
      return res.renderWithMainLayout("errors/404.ejs", {
        title: "User Not Found",
        dwscription: "The author you're looking for doesn't exist.",
        pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        keywords: "user not found, profile error, engineer insights",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

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

    res.renderWithProfileLayout("../pages/profile/notification", {
      title: `${user.username}'s Notifications`,
      description: `Explore the notifications of ${user.username} on Engineer Insights. Stay updated with the latest interactions and activities related to your profile and blogs.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `notifications, ${user.username}, engineer insights, user notifications`,
      user: { ...user },
      isAuthenticated,
      profile: { ...user },
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).render("errors/500.ejs", {
      title: "Server Error",
      message: "An error occurred while fetching the user's profile.",
      isAuthenticated: req.isAuthenticated(),
    });
  }
}

async function getSettings(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId).lean();

    if (!user) {
      return res.status(404).render("../pages/errors/404.ejs", {
        title: "User Not Found",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

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


    res.renderWithProfileLayout("../pages/profile/setting", {
      title: `${user.username}'s Settings`,
      description: `Manage the settings of ${user.username} on Engineer Insights. Customize your profile preferences, privacy settings, and notification options.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `settings, ${user.username}, engineer insights, profile settings`,
      user: { ...user },
      profile: { ...user },
      readerId: null,
      setting: user.settings,
      isAuthenticated,
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
  }
}

async function getSupport(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId).lean();

    if (!user) {
      return res.status(404).render("../pages/errors/404.ejs", {
        title: "User Not Found",
        message: "The author you're looking for doesn't exist.",
        isAuthenticated,
      });
    }

    res.renderWithProfileLayout("../pages/profile/support", {
      title: `${user.username}'s Support`,
      description: `Get support for ${user.username} on Engineer Insights. Access help resources, FAQs, and contact options for assistance with your profile and account.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `support, ${user.username}, engineer insights, profile support`,
      profile: { ...user },
      user: { ...user },
      isAuthenticated,
      readerId: null,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
  }
}

async function updateMode(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.settings.theme = user.settings.theme === "light" ? "dark" : "light";
    console.log("Updated theme:", user.settings.theme);

    req.user = user;
    await user
      .save()
      .then(() => {
        console.log("User save updated successfully");
      })
      .catch((err) => {
        console.error("Error saving user:", err);
        throw err;
      });

    return res.status(200).json({
      success: true,
      message: "Theme updated successfully",
      theme: user.settings.theme,
    });
  } catch (error) {
    console.error("Error updating theme:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the theme",
    });
  }
}

async function updateNotification(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.settings.notifications) {
      user.settings.notifications = false;
    } else {
      user.settings.notifications = true;
    }

    req.user = user;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Theme updated successfully",
    });
  } catch (error) {
    console.error("Error updating theme:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the theme",
    });
  }
}

async function updateSuggestions(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.settings.suggestions) {
      user.settings.suggestions = false;
    } else {
      user.settings.suggestions = true;
    }

    req.user = user;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Suggestiions updated successfully",
      isAuthenticated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the theme",
    });
  }
}

async function update2fa(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();

    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized, no token provided",
      });
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.settings["2fa"] = !user.settings["2fa"];
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Two-factor authentication has been ${
        user.settings["2fa"] ? "enabled" : "disabled"
      }`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

async function updateNewsletter(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized, no token provided",
      });
    }
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.settings.newsletter) {
      user.settings.newsletter = false;
    } else {
      user.settings.newsletter = true;
    }
    req.user = user;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Newsletter updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the newsletter",
    });
  }
}

async function deleteProfile(req, res) {
  console.log(
    "req.isAuthenticated() i am clicked to delete",
    req.isAuthenticated()
  );
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized, no token provided",
      });
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await cloudinary.uploader.destroy(user.avatarId);
    await UserModel.findByIdAndDelete(userId);
    const blogs = await BlogModel.find({ author: userId });
    // Extract all public_id values from blogs
    const publicIds = blogs.map((blog) => blog.blogPhotoId).filter((id) => id); // Filter to avoid null values

    if (publicIds.length > 0) {
      //  Delete images from Cloudinary
      await cloudinary.api.delete_resources(publicIds);
    }

    await BlogModel.deleteMany({ author: userId });
    await CommentModel.deleteMany({ author: userId });
    await NotificationModel.deleteMany({ user: userId });
    await ReportModel.deleteMany({ readerId: userId });

    req.logout((err) => {
      if (err) {
        console.error("Error logging out:", err);
        return res.status(500).json({
          success: false,
          message: "Error logging out user",
        });
      }

      return res.status(200).json({
        success: true,
        message: "User profile deleted successfully",
      });
    });
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the profile",
    });
  }
}

async function blockUser(req, res) {
  console.log("req.params", req.params);
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized, no token provided",
      });
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const blockedUserId = req.params.id;

    if (!blockedUserId) {
      console.log("Blocked user ID is required");
      return res.status(400).json({
        success: false,
        message: "Blocked user ID is required",
      });
    }

    if (user.blockedUsers.includes(blockedUserId)) {
      user.blockedUsers.pop(blockedUserId);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "User unblocked successfully",
      });
    } else {
      user.blockedUsers.push(blockedUserId);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "User blocked successfully",
      });
    }
  } catch (error) {
    console.error("Error blocking user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while blocking the user",
    });
  }
}

async function getFeaturedBlog(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const countFreeBlogs = await BlogModel.countDocuments({
      author: userId,
      isFree: true,
    });
    let freeBlogsLeft = 0;
    console.log("countFreeBlogs", countFreeBlogs);
    if (user.subscription === "pro") {
      freeBlogsLeft = 1 - countFreeBlogs;
    } else if (user.subscription === "elite") {
      freeBlogsLeft = 5 - countFreeBlogs;
    }

    const featuredBlogs = await BlogModel.find({ featured: true })
      .populate("author", "username avatar")
      .lean();

    const nonfeaturedBlogs = await BlogModel.find({ featured: false })
      .populate("author", "username avatar")
      .lean();

    console.log(user);
    res.renderWithMainLayout("../pages/profile/feature.ejs", {
      title: "Featured Blogs",
      description: `Manage your featured blogs on Engineer Insights. Highlight your best content and showcase your expertise to the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `featured blogs, engineer insights, user featured content`,
      newBlogs: nonfeaturedBlogs,
      featuredBlogs: featuredBlogs,
      isAuthenticated,
      profile: { ...user },
      freeBlogsLeft,
      user: user,
    });
  } catch (error) {
    console.error("Error fetching featured blogs:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getBlockedUsers(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

    res.renderWithProfileLayout("../pages/profile/blockedUsers.ejs", {
      title: "Blocked Users",
      description: `Manage your blocked users on Engineer Insights. Review and update your list of blocked users to control your interactions within the engineering community.`,
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: `blocked users, engineer insights, user blocked list`,
      isAuthenticated,
      profile: user,
      user: user,
      featuredBlogs,
    });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching blocked users",
    });
  }
}

async function getAllBlockedUsers(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized, no token provided",
      });
    }
    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const blockedUsers = await UserModel.find({
      _id: { $in: user.blockedUsers },
    })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalBlockedUsers = user.blockedUsers.length;

    for (const blockedUser of blockedUsers) {
      if (blockedUser.avatar) {
        try {
          const avatarBuffer = await getAvatarImage(blockedUser.avatar);
          blockedUser.avatarUrl = avatarBuffer
            ? `data:image/jpeg;base64,${avatarBuffer.toString("base64")}`
            : null;
        } catch (err) {
          console.error(
            `Error fetching avatar for user ${blockedUser._id}:`,
            err
          );
          blockedUser.avatarUrl = null;
        }
      } else {
        blockedUser.avatarUrl = null;
      }
    }

    return res.status(200).json({
      blockedUsers,
      totalBlockedUsers,
      page,
      totalPages: Math.ceil(totalBlockedUsers / limit),
    });
  } catch (error) {
    console.error("Error in getAllBlockedUsers function:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function getVerifyOtp(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    const otpResponse = await fetch(
      `${process.env.BASE_URL}/auth/generateOTP?username=${encodeURIComponent(
        user.username
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (otpResponse.status !== 201) {
      throw new Error("Failed to generate OTP");
    }

    const otpData = await otpResponse.json();

    const requestData = {
      username: user.username,
      userEmail: user.email,
      text: `Your OTP for password reset is ${otpData.code}. If you did not request this, please ignore this email.`,
      subject: "OTP for Password Reset - Engineer Insights",
    };
    const mailResponse = await fetch(
      `${process.env.BASE_URL}/auth/registerMail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }
    );

    if (!mailResponse.ok) {
      throw new Error("Failed to send email");
    }

    res.renderWithProfileLayout("../partials/resetVerify.ejs", {
      title: "Verify User",
      description: "Verify user OTP for password reset.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "verify otp, password reset, engineer insights",
      isAuthenticated,
      profile: { ...user },
      username: user.username,
      user: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error occurred while verifying OTP" });
  }
}

async function getResetPassword(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.redirect("/signin");
    }

    const userId = req.user._id;
    const user = await UserModel.findById(userId);
    console.log("user", user);
    res.renderWithProfileLayout("../partials/resetPassword.ejs", {
      title: "Reset Password",
      description: "Reset your password securely.",
      pageUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      keywords: "reset password, secure password, engineer insights",
      isAuthenticated,
      profile: { ...user },
      username: user.username,
      user: user,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ error: "An error occurred while resetting password" });
  }
}

async function updateRecent(req, res) {
  try {
    const { blogId } = req.body;

    if (!req.isAuthenticated()) {
      return res.status(401).send({ error: "Authentication token is missing" });
    }

    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const blog = await BlogModel.findById(blogId);
    if (!blog) {
      return res.status(404).send({ error: "Blog not found" });
    }

    if (blog.status === "draft" || blog.status === "Archived") {
      return res.status(400).send({ error: "Blog is not published" });
    }

    const blogObjectId = new mongoose.Types.ObjectId(blogId);

    if (!user.recentViews.some((id) => id.equals(blogObjectId))) {
      user.recentViews.push(blogObjectId);
    }

    if (user.recentViews.length > 10) {
      user.recentViews = user.recentViews.slice(-10);
    }

    await user.save();
    res.status(200).send({ message: "Recent updated successfully" });
  } catch (error) {
    console.error("Error updating recent views:", error);
    res.status(500).send({ error: "An error occurred while updating recent" });
  }
}

async function getRecent(req, res) {
  try {
    const { reader, pages, limit } = req.query;
    const user = await UserModel.findById(reader);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const recentBlogs = await BlogModel.find({ _id: { $in: user.recentViews } })
      .populate("author", "username avatar")
      .lean();

    for (const blog of recentBlogs) {
      try {
        if (blog.author.avatar) {
          const avatarBuffer = await getAvatarImage(blog.author.avatar);
          blog.author.avatarUrl = avatarBuffer
            ? `data:image/jpeg;base64,${avatarBuffer.toString("base64")}`
            : null;
        } else {
          blog.author.avatarUrl = null;
        }

        if (blog.blogPhoto) {
          const blogPhotoBuffer = await getAvatarImage(blog.blogPhoto);
          blog.image = blogPhotoBuffer
            ? `data:image/jpeg;base64,${blogPhotoBuffer.toString("base64")}`
            : null;
        } else {
          blog.image = null;
        }
      } catch (err) {
        console.error(`Error fetching images for blog ${blog._id}:`, err);
        blog.author.avatarUrl = null;
        blog.image = null;
      }
    }
    res.status(200).json({ recentBlogs });
  } catch (error) {
    console.error("Error fetching recent blogs:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching recent blogs" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  checkUsernameAvailability,
  searchProfile,
  getUpdateProfile,
  getAuthorBySlug,
  getAuthorDrafts,
  getArchivedBlogs,
  savedBlogs,
  getSavedBlogs,
  getUserReports,
  getUserNotification,
  getUserFollowers,
  getUserFollowing,
  getSettings,
  getSupport,
  updateMode,
  updateNotification,
  updateSuggestions,
  updateNewsletter,
  update2fa,
  deleteProfile,
  getBlockedUsers,
  getFeaturedBlog,
  getAllBlockedUsers,
  blockUser,
  getVerifyOtp,
  getResetPassword,
  updateRecent,
  getRecent,
};
