const express = require("express");
const router = express.Router();
const authcontroller = require("../controllers/auth.controller");
const { localVariables } = require("../middleware/auth");
const { registerMail } = require("../controllers/mailer");
const passport = require("passport");

router.get(
  "/generateOTP",
  authcontroller.verifyUser,
  localVariables,
  authcontroller.generateOTP
);

router.get("/verifyOTP", authcontroller.verifyOTP);
router.get("/otpreset", authcontroller.generateOTPReset);
router.get("/createResetSession", authcontroller.createResetSession);

router.get(
  "/google/home",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/signin",
    failureFlash: true,
  })
);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

router.get("/resendOTP", authcontroller.resendOTP);
router.post("/register", authcontroller.register);
router.post("/registerMail", registerMail);
router.post("/authenticate", authcontroller.verifyUser, (req, res) => {
  res.end();
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Error during authentication:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (info && info.message === "2FA required") {
      return res.status(200).json({ twoFactor: true, redirect: info.redirect });
    }

    if (!user) {
      return res.status(401).json({ error: info.message || "Authentication failed" });
    }

    req.login(user, (err) => {
      if (err) {
        
        return res.status(500).json({ error: "Failed to log in" });
      }

      return res.status(200).json({ success: true, redirect: "/" });
    });
  })(req, res, next);
});

router.post("/twoFactorVerify", authcontroller.twoFactorVerify);

router.put(
  "/resetPassword",
  authcontroller.verifyUser,
  authcontroller.resetPassword
);
router.post("/logout", authcontroller.logout);

module.exports = router;
