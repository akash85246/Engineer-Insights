const express = require("express");
const router = express.Router();
const followController = require("../controllers/follow.controller");


router.post("/follow/:slug", followController.followandunfollow);
router.delete("/remove/:slug", followController.removefollower);

router.get("/search/followers/:slug",followController.getfollowers);
router.get("/search/following/:slug",followController.getfollowing);


module.exports = router;