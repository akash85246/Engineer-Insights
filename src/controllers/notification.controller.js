const NotificationModel = require("../models/Notification.model");
const User = require("../models/User.model");

async function createNotification({
  blogId,
  user,
  notificationType,
  subject,
  message,
  reportId,
}) {
  try {
    const notification = new NotificationModel({
      blogId,
      user,
      notificationType,
      subject,
      message,
    });
    if (reportId) {
      notification.reportId = reportId;
    }
    console.log("notification", notification);
    await notification.save();

    const userDoc = await User.findById(user);
    if (!userDoc) {
      throw new Error("User not found");
    }

    const requestData = {
      username: userDoc.username,
      userEmail: userDoc.email,
      text: message,
      subject: subject || "You have a new notification",
    };
    if (userDoc.settings.notifications == true) {
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
        console.log("mailResponse", mailResponse);
        throw new Error("Failed to send email");
      }
      return { message: "Notification created and email sent" };
    }
    return { message: "Notification created" };
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error("Server error");
  }
}

async function getUserNotifications(req, res) {
  try {
    const { userId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const notifications = await NotificationModel.find({ user: userId })
      .populate("blogId", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalNotifications = await NotificationModel.countDocuments({
      user: userId,
    });

    return res.status(200).json({
      notifications,
      totalNotifications,
      page,
      totalPages: Math.ceil(totalNotifications / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationModel.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.isRead = !notification.isRead;
    await notification.save();

    return res.status(200).json({ notification });
  } catch (error) {
    console.error("Error toggling notification read status:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function deleteNotification(req, res) {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationModel.findByIdAndDelete(
      notificationId
    );
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res
      .status(200)
      .json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function deleteAllNotifications(req, res) {
  try {
    const { userId } = req.params;
    await NotificationModel.deleteMany({ user: userId });
    return res
      .status(200)
      .json({ message: "All notifications deleted successfully" });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  createNotification,
  deleteAllNotifications,
};
