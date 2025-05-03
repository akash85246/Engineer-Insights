const JobLog = require("../models/JobLog.model.js");
const User = require("../models/User.model.js");
const Payment = require("../models/Payment.model.js");
const Blog = require("../models/Blog.model.js");
const { updateEngagementScores ,getPopularTagsForUser,getPopularBlogCategory} = require("../controllers/analytic.controller.js");

async function logJobStatus(jobName, status, message) {
  const jobLog = new JobLog({ jobName, status, message });
  await jobLog.save();
}

async function runScheduledJob() {
  const now = new Date();
  try {
    const blogs = await Blog.find();
    for (const blog of blogs) {
      if (blog.featured && blog.featuredDetails) {
        const { featuredAt, featureDuration } = blog.featuredDetails;
        if (featuredAt) {
          const endDate = new Date(featuredAt);
          console.log("Old End Date:", endDate.toDateString());
          endDate.setDate(endDate.getDate() + featureDuration);
          console.log("featuredAt:", featuredAt.toDateString());
          console.log("New End Date:", endDate.toDateString());
          console.log("Current Date:", now.toDateString());
          console.log("featureDuration:", featureDuration);

          if (now > endDate) {
            blog.featured = false;
            blog.isFree=false;
            await blog.save();
            await logJobStatus(
              "featuredBlogUpdate",
              "success",
              `Updated blog "${blog.title}" to not featured.`
            );
            console.log(
              `Updated blog "${blog.title}" to not featured.`
            );
          }
        }
      }
    }
  } catch (error) {
    await logJobStatus(
      "featuredBlogUpdate",
      "failure",
      `Error: ${error.message}`
    );
  }
}

async function runSubscription(userId) {
  console.log("Updating subscription status...");
  try {
    const now = new Date();
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found.");
      return null;
    }

    const recentPayment = await Payment.findOne({
      user: userId,
      paymentType: "subscription",
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!recentPayment) {
      console.log("No subscription payments found.");
      return null;
    }

    if (now > recentPayment.subscriptionDetails.endDate) {
      recentPayment.endDate = now;
      recentPayment.paymentStatus = "expired";
      await recentPayment.save();
      user.subscription = "regular";
      await user.save();
      await logJobStatus(
        "subscriptionUpdate",
        "success",
        `User subscription updated to regular.`
      );
      console.log("User subscription updated to regular.");
    }
  } catch (error) {
    console.error("Error updating subscription status:", error.message);
    await logJobStatus(
      "subscriptionUpdate",
      "failure",
      `Error: ${error.message}`
    );
  }
}

async function updateAnalytics() {
  getPopularTagsForUser();
  updateEngagementScores();
  getPopularBlogCategory();
  console.log("User analytics updated successfully!");
}


module.exports = { runScheduledJob, runSubscription,updateAnalytics};
