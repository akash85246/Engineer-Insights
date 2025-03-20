const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");

router.get("/:userId", notificationController.getUserNotifications);

router.post("/mark-read/:notificationId", notificationController.markNotificationAsRead);

router.delete("/:notificationId", notificationController.deleteNotification); 
router.delete("/all/:userId", notificationController.deleteAllNotifications);

module.exports = router;
