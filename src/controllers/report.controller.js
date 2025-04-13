const ReportModel = require("../models/Report.model");
const UserModel = require("../models/User.model");
const BlogModel = require("../models/Blog.model");
const NotificationModel = require("../models/Notification.model");
const AnalyticModel = require("../models/Analytic.model");
const { createNotification } = require("./notification.controller");

async function createReport(req, res) {
  try {
    const slug = req.params.slug;
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const blog = await BlogModel.findOne({ slug }).populate("author", "_id");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const blogId = blog._id;

    const readerId = req.user._id;

    const user = await UserModel.findOne({ _id: readerId });

    const { reason, description } = req.body;

    if (!reason || !description) {
      return res
        .status(400)
        .json({ message: "Reason and description are required" });
    }

    const newReport = new ReportModel({
      blogId,
      authorId: blog.author._id,
      readerId,
      reason,
      description,
    });

    const report = await newReport.save();

    blog.reports.push(report._id);
    user.reports.push(report._id);

    await blog.save();
    await user.save();

    const notificationData = {
      blogId: blogId._id,
      user: user._id,
      reportId: report._id,
      notificationType: "new_report",
      subject: `Report: ${reason}`,
      message: `Your blog has been reported \n due to ${reason} \n ${description}`,
    };

    await createNotification(notificationData);
    const currentDate = new Date();
    const dateOnly = new Date(currentDate.setHours(0, 0, 0, 0));
    const currentHour = new Date().getHours();

    const existingEntry = await AnalyticModel.findOne({
      user_id: blog.author,
      "engagementTrend.date": dateOnly,
      "engagementTrend.hour": currentHour,
    });

    if (existingEntry) {
      await AnalyticModel.findOneAndUpdate(
        {
          user_id: blog.author,
          "engagementTrend.date": dateOnly,
          "engagementTrend.hour": currentHour,
        },
        {
          $inc: {
            "engagementTrend.$.reports": 1,
          },
        },
        { new: true }
      );
    } else {
      await AnalyticModel.findOneAndUpdate(
        { user_id: blog.author },
        {
          $push: {
            engagementTrend: {
              date: dateOnly,
              hour: currentHour,
              views: 0,
              likes: 0,
              comments: 0,
              saves: 0,
              reports: 1,
            },
          },
        },
        { new: true, upsert: true }
      );
    }

    return res.status(201).json({ message: "Report submitted successfully" });
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getReports(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const readerId = req.user._id;

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;
    const reports = await ReportModel.find({ readerId })
      .populate("blogId", "title blogPhoto slug lastModified")
      .populate("readerId", "username slug avatar lastname firstname createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const totalReports = await ReportModel.countDocuments({ readerId });

    res.status(200).json({
      totalReports,
      page,
      pageSize,
      reports: reports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getUserBlogReports(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();

    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const readerId = req.user._id;

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;

    const user = await UserModel.findById(readerId).populate(
      "blogs",
      "_id slug"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userBlogIds = user.blogs.map((blog) => blog._id);

    const reports = await ReportModel.find({ blogId: { $in: userBlogIds } })
      .populate("blogId", "title blogPhoto slug lastModified")
      .populate("readerId", "username slug avatar lastname firstname")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const totalReports = await ReportModel.countDocuments({
      blogId: { $in: userBlogIds },
    });

    res.status(200).json({
      totalReports,
      page,
      pageSize,
      reports: reports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getReportById(req, res) {
  try {
    const reportId = req.params.id;
    const report = await ReportModel.findById(reportId)
      .populate("blogId", "title blogPhoto slug")
      .populate("readerId", "username slug avatar lastname firstname");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function timeLeftToResolveReport(req, res) {
  try {
    const reportId = req.params.id;
    const report = await ReportModel.findById(reportId)
      .populate("blogId", "author")
      .populate("readerId", "username");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const blog = await BlogModel.findById(report.blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const author = await UserModel.findById(blog.author);
    const reader = await UserModel.findById(report.readerId);
    const timeToResolve = Math.abs(
      report.createdAt.getTime() - new Date().getTime()
    );

    res.status(200).json({
      report,
      timeToResolve,
      author,
      reader,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function updateStatus(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    console.log("Received status update request:", req.body);

    if (!isAuthenticated) {
      return res.status(401).json({ message: "Sign in first" });
    }

    if (req.body.status === "Deleted") {
      console.log("Delete request received");
      return res.status(200).json({ message: "Status updated successfully" });
    }

    const report = await ReportModel.findById(req.params.id);

    if (!report) {
      console.log("Report not found");
      return res.status(404).json({ message: "Report not found" });
    }

    if (!report.authorId.equals(req.user._id)) {
      console.log("User not authorized to update status");

      return res.status(401).json({ message: "User not authorized" });
    }

    const validStatuses = ["Pending", "Reviewed", "Resolved", "Deleted"];

    const status = validStatuses.includes(req.body.status)
      ? req.body.status
      : "Pending";

    report.status = status;
    await report.save();

    return res.status(200).json({ message: "Status updated successfully" });
  } catch (e) {
    console.error("Error updating blog status:", e);
    return res.status(500).json({ message: e });
  }
}

async function resolveReport(req, res) {
  try {
    const reportId = req.params.id;
    const report = await ReportModel.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    report.status = "Resolved";
    await report.save();

    res.status(200).json({ message: "Report resolved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function deleteReport(req, res) {
  const isAuthenticated = req.isAuthenticated();

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized, no token provided" });
  }

  const userId = req.user._id;

  try {
    const reportId = req.params.id;
    const report = await ReportModel.findById({ _id: reportId }).populate(
      "blogId",
      "author"
    );
    console.log(report);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const user = await UserModel.findById(userId);
    const blog = await BlogModel.findById(report.blogId);
    let notification = null;
    if (report.readerId) {
      console.log("Notification", report._id);
      notification = await NotificationModel.findOne({
        reportId: report._id,
      });
    }

    if (
      report.blogId.author.toString() === userId ||
      report.readerId.toString() === userId
    ) {
      await report.deleteOne();
      user.reports.pull(reportId);
      await user.save();

      blog.reports.pull(reportId);
      await blog.save();

      if (notification) {
        console.log("Notification", notification);
        await notification.deleteOne();
      }

      return res.status(200).json({ message: "Report deleted successfully" });
    } else {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to delete this report",
      });
    }
  } catch (error) {
    console.error("Error deleting report:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
}

async function searchReport(req, res) {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.status(400).json({ message: "Keyword is required" });
    }
    const reports = await ReportModel.find({
      $or: [
        { reason: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ],
    })
      .populate("blogId", "title blogPhoto slug")
      .populate("readerId", "username slug avatar lastname firstname")
      .sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createReport,
  getReports,
  getReportById,
  timeLeftToResolveReport,
  resolveReport,
  updateStatus,
  deleteReport,
  searchReport,
  getUserBlogReports,
};
