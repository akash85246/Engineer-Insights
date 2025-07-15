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
    console.log("Verifying user...");
    const { username } = req.method == "GET" ? req.query : req.body;
    const exist = await UserModel.findOne({ username });
    if (!exist) return res.status(400).send({ error: "User not found" });
    next();
  } catch (error) {
    return res.status(401).send({ error: "Authentication Error" });
  }
}


async function twoFactorVerify(req, res) {
  const { code, username } = req.body;
  // Check if OTP matches
  if (parseInt(req.app.locals.OTP) !== parseInt(code)) {
    return res
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
      console.error("User not found:", username);
     return res.status(404).json({ msg: "User not found" });
    }

    
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
        res.status(500).json({ error: "Login failed" });
      }
      delete req.session.otp;
      delete req.session.twoFactor;
      return res.status(200).json({ success: true, redirect: "/" });
    });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
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

    
    const newUser = await UserModel.create({
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

    const loginTime = new Date();

    await AnalyticsModel.updateOne(
      { user_id: newUser._id },
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
     return res.status(200).json({ success: true, redirect: "/" });
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
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
  console.log("Fetching user data...");
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


async function handleOTPGeneration(username, app, session) {
  console.log("Generating OTP for user:", username);
  const otpCode = otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  app.locals.OTP = otpCode;
  session.twoFactor = { username };

  const user = await UserModel.findOne({ username });
  if (!user) {
    
    return res.status(404).send({ error: "User not found" });
  }

  const requestData = {
    username: user.username,
    userEmail: user.email,
    text: `Your One-Time Password (OTP) is ${otpCode}. Use this to complete your verification process. If you did not initiate this request, please ignore this email.`,
    subject: "Your OTP - Engineer Insights",
  };

  const mailResponse = await fetch(`${process.env.BASE_URL}/auth/registerMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });

  if (!mailResponse.ok) {
    throw new Error("Failed to send OTP email");
  }

  return otpCode;
}

async function generateOTP(req, res) {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).send({ error: "Username is required" });
  }

  try {
    const otpCode = await handleOTPGeneration(username, req.app, req.session);

    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    req.session.twoFactor = {
    userId: user._id,
    username: user.username,
    email: user.email,
    };
   return res.status(201).send({ msg: "OTP generated successfully", redirect:`/verify?username=${username}` });
  } catch (error) {
    console.error("Error generating OTP:", error);
    res.status(500).send({ error: "Failed to generate OTP" });
  }
}
      


async function verifyOTP(req, res) {
  const { code } = req.query;
  console.log("Verifying OTP:", code);
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
     if (req.session.passwordReset) {
      req.session.passwordReset = null;
    }
    return res.status(201).send({ msg: "Record updated......" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).send({ error: "Internal server error" });
  }
}

async function resendOTP(req, res) {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).send({ error: "Username is required" });
    }

    const otpCode = await handleOTPGeneration(username, req.app, req.session);
    
    return res.status(201).send({ msg: "OTP resent successfully", otp: otpCode });
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).send({ error: "Failed to resend OTP" });
  }
}

async function generateOTPReset(req, res) {
  const { username } = req.query;
  req.session.passwordReset = true;
  if (!username) {
    return res.status(400).send({ error: "Username is required" });
  }


  try {
    const otpCode = await handleOTPGeneration(username, req.app, req.session);
    return res.status(201).send({ msg: "OTP generated successfully", redirect:`/verify?username=${username}` });
  } catch (error) {
    console.error("Error generating OTP:", error);
    return res.status(500).send({ error: "Failed to generate OTP" });
  }
}


module.exports = {
  register,
  getUser,
  generateOTP,
  verifyOTP,
  createResetSession,
  resetPassword,
  verifyUser,
  logout,
  twoFactorVerify,
  handleOTPGeneration,
  resendOTP,
  generateOTPReset,
};
