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
router.get("/createResetSession", authcontroller.createResetSession);
router.get("/user/delete", authcontroller.userDelete);

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

router.post("/register", authcontroller.register);
router.post("/registerMail", registerMail);
router.post("/authenticate", authcontroller.verifyUser, (req, res) => {
  res.end();
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Error during authentication:", err);
      return res.status(500).send("Internal Server Error");
    }
     console.log(info, user);
    if (info && info.message === "2FA required") {
      return res.redirect(info.redirect);
    }

    if (!user) {
      req.flash("error", info.message || "Authentication failed");
      return res.redirect("/signin");
    }

 

    req.login(user, (err) => {
      if (err) {
        console.error("Error logging in user:", err);
        return res.status(500).send("Failed to log in");
      }

      return res.redirect("/");
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
