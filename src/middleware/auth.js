const jwt = require("jsonwebtoken");

async function Auth(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/signin");
    }
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;

    next();
  } catch (error) {
    res.clearCookie("token");
    res.redirect("/signin");
  }
}

async function localVariables(req, res, next) {
  try {
    req.app.locals = {
      OTP: null,
      resetSession: false,
    };
    next();
  } catch (error) {
    return res.status(404).json({ msg: "Local variables can't be accessed" });
  }
}

module.exports = { Auth, localVariables };
