const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { Auth } = require("../middleware/auth");

router.post("/:slug", reportController.createReport);

router.get("/", reportController.getReports);
router.get("/user", reportController.getUserBlogReports,);


router.get("/:id", reportController.getReportById);


router.get("/:id/time-left", reportController.timeLeftToResolveReport);

router.patch("/:id/resolve", reportController.resolveReport);
router.patch("/staus/:id", reportController.updateStatus);

router.delete("/:id", reportController.deleteReport);

router.get("/search", reportController.searchReport);

router.patch("/update-status/:id", reportController.updateStatus);

module.exports = router;
