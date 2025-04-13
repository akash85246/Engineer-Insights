const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const http = require("http");
const session = require("express-session");
const flash = require("connect-flash");
const GoogleStrategy = require("passport-google-oauth2");
const { Strategy } = require("passport-local");
const passport = require("passport");
const socketIo = require("socket.io");
const argon2 = require("argon2");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require('uuid'); 
const AnalyticsModel = require("./models/Analytic.model");

dotenv.config();
const {
  createNotification,
} = require("./controllers/notification.controller.js");

const authrouter = require("./routes/auth.route.js");
const blogrouter = require("./routes/blog.route.js");
const profilerouter = require("./routes/profile.route.js");
const commentrouter = require("./routes/comment.route.js");
const reportrouter = require("./routes/report.route.js");
const followrouter = require("./routes/follow.route.js");
const notificationrouter = require("./routes/notification.route.js");
const paymentrouter = require("./routes/payment.route.js");
const contactrouter = require("./routes/contact.route.js");
const newsletterrouter = require("./routes/newsletter.route.js");

const UserModel = require("./models/User.model");

const router = require("./routes/routes.js");
const suggestionrouter = require("./routes/suggestion.route.js");

const { startScheduler } = require("./middleware/scheduler.js");
const { connect, gfs } = require("./database/connection");
const commentController = require("./controllers/comment.controller");
const { default: axios } = require("axios");

const app = express();
const port = process.env.PORT;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);
app.use(flash());

console.log("Setting up server...");
const server = http.createServer(app);
const io = socketIo(server);

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("tiny"));
app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../public/images/uploads")));
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(passport.initialize());
app.use(passport.session());

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("newComment", (data) => {
    try {
      commentController.handleNewComment(socket, { body: data });
      
    } catch (error) {
      console.error("Error handling new comment:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.use((req, res, next) => {
  res.renderWithMainLayout = (view, options = {}) => {
    res.render("layouts/main.layout.ejs", {
      ...options,
      view: view,
    });
  };
  next();
});

app.use((req, res, next) => {
  res.renderWithAuthLayout = (view, options = {}) => {
    res.render("layouts/auth.layout.ejs", {
      ...options,
      view: view,
    });
  };
  next();
});

app.use((req, res, next) => {
  res.renderWithProfileLayout = (view, options = {}) => {
    res.render("layouts/profile.layout.ejs", {
      ...options,
      view: view,
    });
  };
  next();
});

app.use("/api/profile", profilerouter);
app.use("/api/payment", paymentrouter);
app.use("/auth", authrouter);
app.use("/api/blog", blogrouter);
app.use("/api/comments", commentrouter);
app.use("/api/reports", reportrouter);
app.use("/api/user", followrouter);
app.use("/api/notifications", notificationrouter);
app.use("/api/suggestion", suggestionrouter);
app.use("/api/contact", contactrouter);
app.use("/api/newsletter", newsletterrouter);
app.use("/", router);

app.use(async (req, res) => {
  let user = null;

  const defaultSettings = {
    theme: "light",
    notifications: true,
  };
  const isAuthenticated = req.isAuthenticated();
  if (isAuthenticated) {
    const userId = req.user._id;
    user = await UserModel.findById(userId);
  }

  if (!user) {
    user = { settings: defaultSettings };
  } else if (!user.settings) {
    user.settings = defaultSettings;
  }
  res.status(404).renderWithMainLayout("../pages/errors/404.ejs", {
    title: "Page Not Found",
    isAuthenticated,
    user: user,
  });
});

app.use(async (err, req, res, next) => {
  let user = null;

  const defaultSettings = {
    theme: "light",
    notifications: true,
  };
  const isAuthenticated = req.isAuthenticated();
  if (isAuthenticated) {
    const userId = req.user._id;
    user = await UserModel.findById(userId);
  }

  if (!user) {
    user = { settings: defaultSettings };
  } else if (!user.settings) {
    user.settings = defaultSettings;
  }
console.error("Error:", err);
  res
    .status(500)
    .renderWithMainLayout("../pages/errors/500.ejs", {
      title: "Internal Server Error",
      isAuthenticated,
      user: user,
    });
});

app.use((req, res, next) => {
  req.setTimeout(120000);
  next();
});

passport.use(
  "local",
  new Strategy(
    {
      usernameField: "username",
      passwordField: "password",
      passReqToCallback: true,
    },
    async function verify(req, username, password, cb) {
      try {
        // Fetch user by username
        const user = await UserModel.findOne({ username });
        if (!user) {
          return cb(null, false, { message: "User not found" });
        }

        // Verify password
        const isPasswordValid = await argon2.verify(user.password, password);
        if (!isPasswordValid) {
          return cb(null, false, { message: "Invalid password" });
        }

        // Check if 2FA is enabled
        if (user.settings["2fa"]) {
          try {
            // Generate OTP
            const otpResponse = await axios.get(
              `${process.env.BASE_URL}/auth/generateOTP`,
              { params: { username: user.username } }
            );
            if (otpResponse.status !== 201) {
              return cb(null, false, { message: "Failed to generate OTP" });
            }

            const { code } = otpResponse.data;

            // Send OTP email
            const emailData = {
              username: user.username,
              userEmail: user.email,
              text: `Your OTP for login is ${code}. If you did not request this, please ignore this email.`,
              subject: "OTP for Login - Engineer Insights",
            };

            const mailResponse = await axios.post(
              `${process.env.BASE_URL}/auth/registerMail`,
              emailData
            );

            if (mailResponse.status !== 200) {
              console.log("Failed to send OTP email:", mailResponse.status);
              return cb(null, false, { message: "Failed to send OTP email" });
            }

            req.session.twoFactor = { userId: user._id };

            // Redirect to 2FA page
            req.session.twoFactor = {
              userId: user._id,
              username: user.username,
            };

            return cb(null, false, {
              message: "2FA required",
              redirect: `/twoFactorAuth/${user.username}`,
            });
          } catch (error) {
            console.error("Error handling 2FA:", error);
            return cb(error);
          }
        }
        try {
          const loginTime = new Date();
          const ipAddress =
            req.ip ||
            req.headers["x-forwarded-for"] ||
            req.connection.remoteAddress;
          const userAgent = req.headers["user-agent"];

          const notificationData = {
            user: user._id,
            notificationType: "new_login",
            subject: `New login detected`,
            message: `A new login was detected on your account. 
          Details:
            - IP Address: ${ipAddress}
            - Time: ${loginTime}
            - Browser/Device: ${userAgent}
          `,
            additionalData: {
              loginTime,
              ipAddress,
              userAgent,
            },
          };

          const notificationResponse = await createNotification(
            notificationData
          );

          if (!notificationResponse) {
            console.error("Failed to create notification:", notificationData);
          }
        } catch (error) {
          console.error("Error creating notification:", error);
        }

        // Authentication successful
        return cb(null, user);
      } catch (error) {
        console.error("Error during login process:", error);
        return cb(error);
      }
    }
  )
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/google/home`,
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await UserModel.findOne({ email: profile.email });
        const loginTime = new Date();

        if (!result) {
          const newUser = await UserModel.create({
            username: profile.displayName,
            firstname: profile.given_name,
            lastname: profile.family_name,
            email: profile.email,
            password: "google",
            googleAnalyticsId: `GA-${uuidv4()}` || null,
            avatar: profile.picture,
            settings: {
              theme: "light",
              notifications: true,
            },
          });
          const user=newUser.save();
          await AnalyticsModel.updateOne(
            { user_id: user._id },
            {
              $push: {
                logins: {
                  date: loginTime,
                  count: 1,
                },
              },
            }
          );
          return cb(null, newUser);
        } else {
           await AnalyticsModel.updateOne(
                { user_id: result._id },
                {
                  $push: {
                    logins: {
                      date: loginTime,
                      count: 1,
                    },
                  },
                }
              );
          return cb(null, result);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

connect()
  .then(() => {
    startScheduler();
    console.log("Database connected successfully");
    server.listen(port, () => {
      console.log(`Server is running at ${process.env.BASE_URL}`);
    });
  })
  .catch((error) => {
    console.error("Invalid database connection:", error);
  });
