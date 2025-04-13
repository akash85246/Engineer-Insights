const mongoose = require("mongoose");
const slugify = require("slugify");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [50, "Username cannot exceed 50 characters"],
      match: [
        /^(?!\s)[a-zA-Z0-9\s]{3,20}(?<!\s)$/,
        "Username must contain only alphanumeric characters and spaces",
      ],
    },
    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    slug: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please provide a valid email address"],
    },
    googleAnalyticsId: {
      type: String,
      trim: true,
      match: [
         /^(UA-\d{4,9}-\d{1,4}|G-[A-Z0-9]{4,12}|GA-[0-9a-fA-F-]+)$/,
        "Please provide a valid Google Analytics ID",
      ],
    },
    firstname: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
      match: [/^[a-zA-Z]{2,50}$/, "Please provide a valid first name"],
    },
    lastname: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      match: [/^[a-zA-Z]{2,50}$/, "Please provide a valid last name"],
    },
    avatar: {
      type: String,
      trim: true,
    },
    avatarId: {
      type: String,
      trim: true,
      default: "",
    },
    age: {
      type: Number,
      min: [0, "Age cannot be negative"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, "Please provide a valid phone number"],
    },
    followers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      validate: {
        validator: function (value) {
          return value.length === new Set(value.map(String)).size;
        },
        message: "Followers must be unique.",
      },
    },
    following: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      validate: {
        validator: function (value) {
          return value.length === new Set(value.map(String)).size;
        },
        message: "Followers must be unique.",
      },
    },
    blogs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
      default: [],
    },
    savedBlogs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
      default: [],
    },
    recentViews: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
      default: [],
    },
    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    reports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report",
      },
    ],
    settings: {
      theme: { type: String, default: "light" },
      notifications: { type: Boolean, default: true },
      suggestions: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true },
      "2fa": { type: Boolean, default: false },
    },
    tags: {
      type: [String],
      default: [],
    },
    github: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: [600, "Bio cannot exceed 600 characters"],
      default: "",
    },
    country: {
      type: String,
      maxlength: [100, "Location cannot exceed 100 characters"],
      default: "",
    },
    state: {
      type: String,
      maxlength: [100, "Location cannot exceed 100 characters"],
      default: "",
    },
    twitter: {
      type: String,
      default: "",
    },
    linkedin: {
      type: String,
      default: "",
    },
    subscription: {
      type: String,
      enum: ["regular", "pro", "elite"],
      default: "regular",
    },
    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre("save", async function (next) {
  this.recentViews = [
    ...new Set(this.recentViews.map((id) => id.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  if (this.recentViews.length > 10) {
    this.recentViews = this.recentViews.slice(-10);
  }

  if (this.isModified("username")) {
    let isUnique = false;
    let usernameToCheck = this.username;
    let counter = 1;

    while (!isUnique) {
      const existingUser = await mongoose.models.User.findOne({
        username: usernameToCheck,
        _id: { $ne: this._id },
      });

      if (existingUser) {
        usernameToCheck = `${this.username}${counter}`;
        counter += 1;
      } else {
        isUnique = true;
      }
    }
    this.username = usernameToCheck;
    this.slug = slugify(this.username, { lower: true, strict: true });
  }
  next();
});
module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
