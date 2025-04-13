const mongoose = require("mongoose");
const { marked } = require("marked");
const slugify = require("slugify");
const createDomPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const dompurify = createDomPurify(new JSDOM().window);

const BlogSchema = new mongoose.Schema({
  blogPhoto: {
    type: String,
    required: true,
    trim: true,
    default: "",
  },
  blogPhotoId: {
    type: String,
    trim: true,
    default: "",
  },
  readingTime: {
    type: String,
    default: "",
    trim: true,
  },
  title: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    default: "",
    trim: true,
  },
  summary: {
    type: Boolean,
    default: false,
  },
  markdown: {
    type: String,
    trim: true,
  },
  sanitizedHtml: {
    type: String,
    default: "",
    trim: true,
  },
  tags: {
    type: [String],
    default: [],
    required: true,
  },
  category: {
    type: String,
    enum: [
      "tech",
      "health",
      "travel",
      "lifestyle",
      "education",
      "business",
      "finance",
      "science",
      "entertainment",
      "sports",
      "food",
      "fashion",
      "art",
      "music",
      "movies",
      "books",
      "gaming",
      "politics",
      "history",
      "law",
      "healthcare",
      "environment",
      "automotive",
      "real-estate",
      "parenting",
      "self-improvement",
      "spirituality",
      "current-events",
      "others",
    ],
    default: "others",
  },
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  views: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
  saves: {
    type: Number,
    default: 0,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
  reports: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
    },
  ],
  allowComments: {
    type: Boolean,
    default: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subauthors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  metaTitle: {
    type: String,
    default: "",
    trim: true,
  },
  metaDescription: {
    type: String,
    default: "",
    trim: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  featuredDetails: {
    featureDuration: {
      type: Number,
      default: function () {
        return this.featured ? 7 : undefined;
      },
    },
    featuredAt: {
      type: Date,
      default: Date.now,
    },
    featuredEnd: {
      type: Date,
      default: function () {
        if (this.featured && this.featureDuration) {
          return new Date(
            Date.now() + this.featureDuration * 24 * 60 * 60 * 1000
          );
        }
        return undefined;
      },
    },
    paymentId: {
      type: String,
    },
  },
  editorspick: {
    type: Boolean,
    default: false,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  audience: {
    type: String,
    enum: ["public", "private", "subscribers"],
    default: "public",
  },
  summary: {
    type: Boolean,
    default: false,
  },
});

BlogSchema.pre("validate", function (next) {
  if (this.title) {
    try {
      this.slug = slugify(this.title, { lower: true, strict: true });
    } catch (error) {
      next(error);
    }
  }

  if (this.markdown) {
    try {
      this.sanitizedHtml = dompurify.sanitize(marked(this.markdown));
    } catch (error) {
      next(error);
    }
  }

  if (!this.metaDescription) {
    this.metaDescription = this.description;
  }
  if (!this.metaTitle) {
    this.metaTitle = this.title;
  }

  if (this.markdown) {
    const wordsPerMinute = 200;
    const wordCount = this.markdown.split(/\s+/).length;
    this.readingTime = `${Math.ceil(wordCount / wordsPerMinute)} min read`;
  }

  next();
});

module.exports = mongoose.models.Blog || mongoose.model("Blog", BlogSchema);
