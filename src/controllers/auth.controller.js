const UserModel = require("../models/User.model");
const argon2 = require("argon2");
const Jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const { v4: uuidv4 } = require('uuid'); 
const { createNotification } = require("./notification.controller");
const AnalyticsModel = require("../models/Analytic.model");
const userModel = require("../models/User.model");

async function verifyUser(req, res, next) {
  try {
    const { username } = req.method == "GET" ? req.query : req.body;
    const exist = await UserModel.findOne({ username });
    if (!exist) return res.status(400).send({ error: "User not found" });
    next();
  } catch (error) {
    return res.status(401).send({ error: "Authentication Error" });
  }
}

async function register(req, res) {
  try {
    const { username, firstname, lastname, password, email, phone } = req.body;
    if (!username || !firstname || !lastname || !password || !email || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await UserModel.findOne({
      $or: [{ username: username }, { email: email }, { phone: phone }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: "Please use a unique username" });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Please use a unique email" });
      }
      if (existingUser.phone === phone) {
        return res
          .status(400)
          .json({ error: "Please use a unique phone number" });
      }
    }

    const hashedPassword = await argon2.hash(password);

    const newUser = new UserModel({
      username,
      firstname,
      lastname,
      email,
      phone,
      password: hashedPassword,
      googleAnalyticsId: `GA-${uuidv4()}` || null,
      settings: {
        theme: "light",
        notifications: true,
      },
    });




    await newUser.save();
    const loginTime = new Date();

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
    req.login(newUser, (err) => {
      res.redirect("/");
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  const defaultSettings = {
    theme: "light",
    notifications: true,
  };

  try {
    let user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(400).json({ error: "Username not found" });
    }

    if (!user.settings) {
      user.settings = defaultSettings;
    }

    const isMatch = await (user.password, password);

    if (!isMatch) {
      return res.status(400).json({ error: "Credentials are incorrect" });
    }

    if (user.settings["2fa"] == true) {
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
      return res.status(401).json({
        message: "Two-factor authentication required",
        user: user,
      });
    }

    const token = Jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3 * 86400000,
    });

    const loginTime = new Date();
    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const notificationData = {
      user: user._id,
      notificationType: "new_login",
      subject: `New login detected`,
      message: `A new login was detected on your account from IP address ${ipAddress} at ${loginTime}. Browser/Device: ${userAgent}`,
      additionalData: {
        loginTime,
        ipAddress,
        userAgent,
      },
    };

    const notificationResponse = await createNotification(notificationData);
    if (!notificationResponse) {
      console.error("Failed to create notification:", notificationData);
      return res.status(500).json({ error: "Failed to create notification" });
    }

    //gtag
    fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=G-FG5BN3EY26&api_secret=${process.env.GA_API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: user._id,
          events: [
            {
              name: "user_session_start",
              params: {
                user_id: user._id,
                username: user.username,
                login_time: new Date().toISOString(),
              },
            },
          ],
        }),
      }
    );

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

    res.status(200).json({
      message: "Login successful",
      username: user.username,
      token,
      user: user,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
}

async function twoFactorVerify(req, res) {
  const { code, username } = req.body;
  // Check if OTP matches
  if (parseInt(req.app.locals.OTP) !== parseInt(code)) {
    console.error("Invalid OTP:", req.app.locals.OTP, code);
    res
      .status(400)
      .send({ msg: "Invalid OTP", otp: req.app.locals.OTP, code: code });
  }

  // Reset OTP and session reset flag
  req.app.locals.OTP = null;
  req.app.locals.resetSession = true;

  try {
    // Fetch user from DB
    const user = await userModel.findOne({ username });
    if (!user) {
      res.status(404).json({ msg: "User not found" });
    }

    // Gather login information
    const loginTime = new Date();
    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Prepare notification data
    const notificationData = {
      user: user._id,
      notificationType: "new_login",
      subject: `New login detected`,
      message: `A new login was detected on your account from IP address ${ipAddress} at ${loginTime}. Browser/Device: ${userAgent}`,
      additionalData: {
        loginTime,
        ipAddress,
        userAgent,
      },
    };

    // Create a notification
    const notificationResponse = await createNotification(notificationData);
    if (!notificationResponse) {
      console.error("Failed to create notification:", notificationData);
      res.status(500).json({ error: "Failed to create notification" });
    }

    req.login(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
      }
      req.session.twoFactor = null;
      res.redirect("/");
    });
  } catch (err) {
    console.error("Error during two-factor verification:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

async function logout(req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
}

async function getUser(req, res) {
  const { username } = req.params;
  try {
    if (!username) {
      return res.status(400).send({ error: "username is required" });
    }

    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const { password, ...rest } = Object.assign({}, user.toJSON());
    return res.status(200).send(rest);
  } catch (error) {
    console.error("Error retrieving user data:", error);
    return res.status(500).send({ error: "Internal server error" });
  }
}

async function generateOTP(req, res) {
  const { username } = req.query;
  req.app.locals.OTP = await otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  req.session.twoFactor = { username: username };
  res.status(201).send({ code: req.app.locals.OTP });
}

async function verifyOTP(req, res) {
  const { code } = req.query;
  if (parseInt(req.app.locals.OTP) === parseInt(code)) {
    req.app.locals.OTP = null;
    req.app.locals.resetSession = true;
    return res.status(201).send({ msg: "Verify Sucessfully" });
  }
  return res.status(400).send({ msg: "Invalid OTP" });
}

async function createResetSession(req, res) {
  if (req.app.locals.resetSession) {
    req.app.locals.resetSession = false;
    return res.status(201).send({ msg: "acess granted !!" });
  }
  return res.status(440).send({ msg: "Session Expired !!" });
}

async function resetPassword(req, res) {
  try {
    if (!req.app.locals.resetSession) {
      return res.status(440).send({ error: "Session expired!" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .send({ error: "Username and password are required" });
    }

    const user = await UserModel.findOne({ username });
    if (!user) {
      return res.status(404).send({ error: "Username not found" });
    }

    const hashedPassword = await argon2.hash(password);

    await UserModel.updateOne(
      { username: user.username },
      { password: hashedPassword }
    );

    req.app.locals.resetSession = false;
    req.session.passwordReset = null;
    return res.status(201).send({ msg: "Record updated......" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).send({ error: "Internal server error" });
  }
}

async function userDelete(params) {}

module.exports = {
  register,
  login,
  getUser,
  generateOTP,
  verifyOTP,
  createResetSession,
  resetPassword,
  verifyUser,
  userDelete,
  logout,
  twoFactorVerify,
};
