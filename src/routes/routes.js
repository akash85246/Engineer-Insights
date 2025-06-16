const express = require("express");
const router = express.Router();
const authcontroller = require("../controllers/auth.controller");
const { Country, State } = require("country-state-city");
const userModel = require("../models/User.model");
const PaymentModel = require("../models/Payment.model");
const blogController = require("../controllers/blog.controller");
const profileController = require("../controllers/profile.controller");
const AnalyticController = require("../controllers/analytic.controller");
const { Auth } = require("../middleware/auth");
//auth routes
router.get("/signin", async (req, res) => {
  let user = {
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  if (req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.renderWithAuthLayout("../pages/authorisation/signin", {
    title: "Sign In",
    user: user,
  });
});

router.get("/twoFactorAuth/:username", async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      return res.redirect("/");
    }

    const username = req.params.username;
    const user = await userModel.findOne({ username: username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!req.session.twoFactor || req.session.twoFactor.username !== username) {
      return res.redirect("/signin");
    }

    return res.renderWithAuthLayout("../pages/authorisation/twoFactor.ejs", {
      title: "Two Factor Authentication",
      user: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).send("Internal Server Error");
  }
});

router.get("/signup", (req, res) => {
  let user = {
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  if (req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.renderWithAuthLayout("../pages/authorisation/signup", {
    title: "Sign Up",
    user: user,
  });
});

router.get("/recovery", (req, res) => {
  let user = {
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  if (req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.renderWithAuthLayout("../pages/authorisation/recovery", {
    title: "Recovery Password",
    user: user,
  });
});

router.get("/reset", (req, res) => {
  const { username } = req.query;
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  if (!req.session.twoFactor || req.session.twoFactor.username !== username) {
    return res.redirect("/recovery");
  }

  let user = {
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  res.renderWithAuthLayout("../pages/authorisation/reset", {
    title: "Reset Password",
    username: username,
    user: user,
  });
});

router.get("/verify", (req, res) => {
  const { username } = req.query;
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  if (!req.session.twoFactor || req.session.twoFactor.username !== username) {
    return res.redirect("/recovery");
  }

  let user = {
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  res.renderWithAuthLayout("../pages/authorisation/verify", {
    title: "Verify User",
    username: username,
    user: user,
  });
});

router.get("/user/:username", authcontroller.getUser);

router.get("/countries", (req, res) => {
  const countries = Country.getAllCountries();
  res.json(countries);
});

router.get("/states/:countryCode", (req, res) => {
  const countryCode = req.params.countryCode;
  const states = State.getStatesOfCountry(countryCode);
  res.json(states);
});

router.get("/subscribe", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/signin");
  }
  let user = await userModel.findById(req.user._id);
  let payment = await PaymentModel.findOne({
    user: req.user._id,
    paymentType: "subscription",
    paymentStatus: "completed",
  }).sort({ createdAt: -1 });

  const defaultSettings = {
    theme: "light",
    notifications: true,
  };
  const isAuthenticated = req.isAuthenticated();
  if (!user) {
    user = { settings: defaultSettings };
  }

  res.renderWithMainLayout("../pages/payment/subscription.ejs", {
    title: "Subscribe",
    isAuthenticated,
    user,
    payment: payment,
  });
});

router.get("/contact", async (req, res) => {
  let user = null;
  const isAuthenticated = req.isAuthenticated();
  const defaultSettings = {
    theme: "light",
    notifications: true,
  };

  if (req.isAuthenticated()) {
    user = req.user;
  }
  if (!user) {
    user = { settings: defaultSettings };
  } else if (!user.settings) {
    user.settings = defaultSettings;
  }

  res.renderWithMainLayout("../pages/contact.ejs", {
    title: "Contact Us",
    isAuthenticated,
    user,
  });
});

router.get("/about", async (req, res) => {
  let user = null;
  const defaultSettings = {
    theme: "light",
    notifications: true,
  };

  const isAuthenticated = req.isAuthenticated();

  if (!req.isAuthenticated()) {
    user = req.user;
  }

  if (!user) {
    user = { settings: defaultSettings };
  } else if (!user.settings) {
    user.settings = defaultSettings;
  }

  res.renderWithMainLayout("../pages/about.ejs", {
    title: "About",
    isAuthenticated,
    user,
  });
});
//blog routes

router.get("/blog/edit/:slug", blogController.getEditArticleBySlug);
router.get("/blog/all/:tags?", blogController.getAllBlogs);

router.get(
  "/blog/:slug",
  blogController.limitGuestBlogViews,
  blogController.getArticleBySlug
);

//profile routes
router.get("/profile/edit", profileController.getUpdateProfile);
router.get("/drafts", profileController.getAuthorDrafts);
router.get("/saveBlogs", profileController.savedBlogs);
router.get("/archived", profileController.getArchivedBlogs);
router.get("/analytics", AnalyticController.getAnalytics);
router.get("/reports", profileController.getUserReports);
router.get("/notifications", profileController.getUserNotification);
router.get("/followers/:slug", profileController.getUserFollowers);
router.get("/following/:slug", profileController.getUserFollowing);
router.get("/settings", profileController.getSettings);
router.get("/support", profileController.getSupport);
router.get("/blockedUsers", profileController.getBlockedUsers);
router.get("/featureblog", profileController.getFeaturedBlog);
router.get("/profile/verify", profileController.getVerifyOtp);
router.get("/profile/reset", profileController.getResetPassword);
router.get("/profile/:slug", profileController.getProfile);

router.get("/", async (req, res) => {
  let user = null;

  const defaultSettings = {
    theme: "light",
    notifications: true,
  };
  const isAuthenticated = req.isAuthenticated();
  if (isAuthenticated) {
    const userId = req.user._id;
    user = await userModel.findById(userId);
  }

  if (!user) {
    user = { settings: defaultSettings };
  } else if (!user.settings) {
    user.settings = defaultSettings;
  }

  const popularBlog = await blogController.getPopularBlogs(user._id);
  const latestBlog = await blogController.getLatestBlogs(user._id);
  const featuredBlog = await blogController.getFeaturedBlogs(user._id);
  const editorialBlog = await blogController.getEditorialBlogs(user._id);
  console.log("editorialBlog", editorialBlog.length);
  const authorBlog = await blogController.getFavouriteAuthorBlogs(user._id);

  res.renderWithMainLayout("../pages/home", {
    title: "Home",
    isAuthenticated,
    user: user,
    popularBlog: popularBlog,
    latestBlog: latestBlog,
    featuredBlog: featuredBlog,
    editorialBlog: editorialBlog,
    authorBlog: authorBlog,
  });
});

module.exports = router;
