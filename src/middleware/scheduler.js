const cron = require("node-cron");
const User = require("../models/User.model.js");

const {
  runScheduledJob,
  runSubscription,
  updateAnalytics,
} = require("../controllers/job.controller.js");
function startScheduler() {
  console.log("Starting scheduler...");

  cron.schedule("0 * * * *", async () => {
    console.log("Starting featured blogs update task...");
    try {
      await runScheduledJob();
      console.log("Featured blogs update task completed.");
    } catch (error) {
      console.error("Error in featured blogs update task:", error.message);
    }
  });

  cron.schedule("0 * * * *", async () => {
    console.log("Starting user subscription update task...");
    try {
      const users = await User.find({ subscription: { $ne: "regular" } });

      for (const user of users) {
        await runSubscription(user._id);
      }

      console.log("User subscription update task completed.");
    } catch (error) {
      console.error("Error in user subscription update task:", error.message);
    }
  });

  cron.schedule("*/30 * * * *", async () => {
    console.log("Starting user engagement scores update task...");
    try {
      await updateAnalytics();
      console.log("User engagement scores update task completed.");
    } catch (error) {
      console.error(
        "Error in user engagement scores update task:",
        error.message
      );
    }
  });
  console.log("Schedulers are running simultaneously...");
}

module.exports = { startScheduler };
