const mongoose = require("mongoose");

const analyticsUserSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    averageTime: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    reportsCount: { type: Number, default: 0 },
    blogsCount: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    totalView: {
      type: Number,
      default: 0,
    },
    locations: [
      {
        country: String,
        percentage: Number,
        trafficByHour: {
          "00": Number,
          "01": Number,
          "02": Number,
          "03": Number,
          "04": Number,
          "05": Number,
          "06": Number,
          "07": Number,
          "08": Number,
          "09": Number,
          10: Number,
          11: Number,
          12: Number,
          13: Number,
          14: Number,
          15: Number,
          16: Number,
          17: Number,
          18: Number,
          19: Number,
          20: Number,
          21: Number,
          22: Number,
          23: Number,
        },
        trafficByDay: {
          Monday: Number,
          Tuesday: Number,
          Wednesday: Number,
          Thursday: Number,
          Friday: Number,
          Saturday: Number,
          Sunday: Number,
        },
      },
    ],
    peakLocation: { type: String, default: null },
    peakTime: { type: String, default: null },
    peakDay: { type: String, default: null },
    mostViewedBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    mostReadBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    mostLikedBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    mostCommentedBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    mostReportedBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    mostSavedBlog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      default: null,
    },
    popularBlogCategory: { type: String, default: null },
    popularTags: [
      {
        tag: { type: String, required: true },
        count: { type: Number, default: 0 },
      },
    ],
    engagementTrend: {
      type: [
        {
          date: { type: Date, required: true },
          hour: { type: Number, required: true, min: 0, max: 23 },
          views: { type: Number, default: 0 },
          likes: { type: Number, default: 0 },
          comments: { type: Number, default: 0 },
          saves: { type: Number, default: 0 },
          reports: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    deviceUsage: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
    },
    browserUsage: {
      chrome: { type: Number, default: 0 },
      safari: { type: Number, default: 0 },
      firefox: { type: Number, default: 0 },
      edge: { type: Number, default: 0 },
      opera: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    osUsage: {
      windows: { type: Number, default: 0 },
      mac: { type: Number, default: 0 },
      linux: { type: Number, default: 0 },
      android: { type: Number, default: 0 },
      ios: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    referralTraffic: {
      direct: { type: Number, default: 0 },
      organic: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    searchTraffic: {
      google: { type: Number, default: 0 },
      bing: { type: Number, default: 0 },
      yahoo: { type: Number, default: 0 },
      duckduckgo: { type: Number, default: 0 },
      baidu: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    socialTraffic: {
      facebook: { type: Number, default: 0 },
      twitter: { type: Number, default: 0 },
      linkedin: { type: Number, default: 0 },
      instagram: { type: Number, default: 0 },
      pinterest: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    posts: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 0 },
      },
    ],
    logins: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 1 },
      },
    ],
    categoryViews: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

async function updatePeakValues(doc) {
  if (!doc || !doc.locations || doc.locations.length === 0) return;

  let maxPercentage = -1;
  let peakLocation = null;
  let peakTime = null;
  let peakDay = null;
  let maxTimeTrafficCount = -1;
  let maxDayTrafficCount = -1;

  doc.locations.forEach((location) => {
    if (location.percentage > maxPercentage) {
      maxPercentage = location.percentage;
      peakLocation = location.country || "Unknown";
    }

    Object.entries(location.trafficByHour).forEach(([hour, count]) => {
      if (count > maxTimeTrafficCount) {
        maxTimeTrafficCount = count;
        peakTime = hour;
      }
    });

    Object.entries(location.trafficByDay).forEach(([day, count]) => {
      if (count > maxDayTrafficCount) {
        maxDayTrafficCount = count;
        peakDay = day;
      }
    });

    doc.peakLocation = peakLocation || "Unknown";
    doc.peakTime = peakTime || "Unknown";
    doc.peakDay = peakDay || "Unknown";
  });
}

analyticsUserSchema.pre("save", async function (next) {
  await updatePeakValues(this);
  next();
});

analyticsUserSchema.pre("findOneAndUpdate", async function (next) {
  let doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await updatePeakValues(doc);
    await doc.save();
  }
  next();
});

module.exports =
  mongoose.model("AnalyticsUser", analyticsUserSchema) ||
  mongoose.models.AnalyticsUser;
