const paypal = require("paypal-rest-sdk");
const UserModel = require("../models/User.model");
const PaymentModel = require("../models/Payment.model");
const BlogModel = require("../models/Blog.model");


paypal.configure({
  mode: process.env.PAYPAL_MODE,
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
  headers: { Connection: "Keep-Alive" },
  timeout: 10000,
});

let amount = 0;
let paymentType = "";
let blog = "";
let currency = "";
let featuredDetails = {
  featureDuration: 0,
};
let subscriptionDetails = {};

async function createPayment(req, res) {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  amount = req.body.amount;
  paymentType = req.body.paymentType;
  currency = req.body.currency;

  if (paymentType === "featured") {
    featuredDetails.featureDuration = req.body.featuredDetails.featureDuration;

    blog = req.body.blog;

    if (amount == "free") {
      const user = await UserModel.findById(req.user._id);
      const countFreeBlogs = await BlogModel.countDocuments({
        author: req.user._id,
        isFree: true,
      });
      let freeBlogsLeft = 0;
      if (user.subscription === "pro") {
        freeBlogsLeft = 1 - countFreeBlogs;
      } else if (user.subscription === "elite") {
        freeBlogsLeft = 5 - countFreeBlogs;
      }
      if (freeBlogsLeft <= 0) {
        return res.status(400).send("You have reached the limit of free blogs");
      }

      const blogData = await BlogModel.findById(blog);
      blogData.featured = true;
      blogData.isFree = true;
      blogData.featuredDetails.featureDuration =
        featuredDetails.featureDuration;
      blogData.featuredDetails.featuredAt = new Date();
      await blogData.save();

      return res.renderWithProfileLayout("../pages/payment/success.ejs", {
        title: "Free Blog Used",
        user,
        message: `Your free blog has been successfully published! You have ${freeBlogsLeft} free blogs remaining.`,
        isAuthenticated,
      });
    }
  } else if (paymentType === "subscription") {
    const subscriptionType = req.body.subscriptionType;

    subscriptionDetails.subscriptionType = subscriptionType;

    subscriptionDetails.startDate = new Date();
    const daysToAdd = subscriptionType == "pro" ? 7 : 30;
    const endDate = new Date(subscriptionDetails.startDate);
    endDate.setDate(subscriptionDetails.startDate.getDate() + daysToAdd);
    subscriptionDetails.endDate = endDate;
    subscriptionDetails.frequency =
      subscriptionType === "pro" ? "weekly" : "monthly";
  }

  const create_payment_json = {
    intent: "sale",
    payer: {
      payment_method: "paypal",
    },
    redirect_urls: {
      return_url: `${process.env.BASE_URL}/api/payment/success`,
      cancel_url: `${process.env.BASE_URL}/api/payment/cancel`,
    },
    transactions: [
      {
        amount: {
          currency: currency || "USD",
          total: amount,
        },
        description: `Payment for ${
          paymentType === "featured" ? "featuring" : "subscription"
        } blog`,
      },
    ],
  };

  paypal.payment.create(create_payment_json, (error, payment) => {
    if (error) {
      return res.status(500).json({ error: "PayPal request timed out." });
    } else {
      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === "approval_url") {
          res.redirect(payment.links[i].href);
        }
      }
    }
  });
}

async function paymentSuccess(req, res) {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const userId = req.user._id;
  const user = await UserModel.findById(userId);

  const paymentId = req.query.paymentId;
  const payerId = { payer_id: req.query.PayerID };

  paypal.payment.execute(paymentId, payerId, async (error, payment) => {
    if (error) {
      res.renderWithProfileLayout("../pages/payment/failure.ejs", {
        title: "Payment Failure",
        user,
        isAuthenticated,
        errorMessage: "Error executing PayPal payment",
      });
    } else {
      if (paymentType === "featured") {
        await PaymentModel.create({
          amount: payment.transactions[0].amount.total,
          currency: payment.transactions[0].amount.currency,
          paymentStatus: "completed",
          transactionId: paymentId,
          blog: blog,
          user: user._id,
          paymentType: paymentType,
          featuredDetails: {
            featureDuration: featuredDetails.featureDuration,
          },
        });
      } else if (paymentType === "subscription") {
        await PaymentModel.create({
          amount: payment.transactions[0].amount.total,
          currency: payment.transactions[0].amount.currency,
          paymentStatus: "completed",
          transactionId: paymentId,
          user: user._id,
          paymentType: paymentType,
          subscriptionDetails: subscriptionDetails,
        });
      }

      if (paymentType === "featured") {
        const blogData = await BlogModel.findById(blog);
        blogData.featured = true;
        blogData.featuredDetails.featureDuration =
          featuredDetails.featureDuration;
        await blogData.save();
      } else if (paymentType === "subscription") {
        const userData = await UserModel.findById(user._id);
        userData.subscription = subscriptionDetails.subscriptionType;

        await userData.save();
      }

      res.renderWithProfileLayout("../pages/payment/success.ejs", {
        title: "Payment Success",
        user,
        message: "Payment successful! Thank you for your purchase.",
        isAuthenticated,
      });
    }
  });
}

async function paymentCancel(req, res) {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const userId = req.user._id;
  const user = await UserModel.findById(userId);

  res.renderWithProfileLayout("../pages/payment/cancel.ejs", {
    title: "Payment Cancel",
    user,
    message: "Payment canceled. Please try again.",
    isAuthenticated,
  });
}

async function searchPayment(req, res) {
  try {
    const {
      transactionId,
      paymentType,
      createdAt,
      blog,
      subscriptionDetails,
      featuredDetails,
      page = 1,
      limit = 10,
    } = req.query;

    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    let userId = req.user._id;

    const searchCriteria = { user: userId };

    if (transactionId) {
      searchCriteria.transactionId = transactionId;
    }
    if (blog) {
      searchCriteria.blog = blog;
    }

    if (paymentType) {
      searchCriteria.paymentType = paymentType;
    }

    if (createdAt) {
      searchCriteria.createdAt = { $gte: new Date(createdAt) };
    }

    if (subscriptionDetails) {
      searchCriteria["subscriptionDetails.frequency"] =
        subscriptionDetails.frequency;
    }

    if (featuredDetails) {
      searchCriteria["featuredDetails.featureDuration"] =
        featuredDetails.featureDuration;
    }
    if (paymentType === "featured" && blog) {
      const blogData = await BlogModel.findById(blog);

      if (!blogData) {
        return res.status(404).send("Blog not found");
      }
      if (blogData.isFree == true) {
        const payments = [
          {
            blog: blogData,
            user: req.user,
            featuredDetails: blogData.featuredDetails,
            currency: "",
            amount: "FREE",
          },
        ];
        return res.json({
          payments,
          totalPages: 1,
          currentPage: 1,
          totalPayments: 1,
        });
      }
    }
    const payments = await PaymentModel.find(searchCriteria)
      .populate({
        path: paymentType === "featured" ? "blog" : "user",
        select:
          paymentType === "featured"
            ? "title description blogPhoto _id featured featuredDetails"
            : "username firstname lastname avatar email",
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalPayments = await PaymentModel.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalPayments / limit);
    return res.json({
      payments: payments,
      totalPages,
      currentPage: page,
      totalPayments,
    });
  } catch (error) {
    return res.status(500).send("Error searching for payments");
  }
}

async function changeBlog(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    const userId = req.user._id;

    const { blogId, currentBlogId } = req.body;
    if (blogId === currentBlogId) {
      return res.status(400).send("Blog is already featured");
    }
    const oldBlog = await BlogModel.findById(blogId);
    const payment = await PaymentModel.findOne({
      blog: blogId,
      paymentType: "featured",
      paymentStatus: "completed",
    });

    if (!payment && oldBlog.isFree == false) {
      return res.status(404).send("Payment not found");
    }

    const currentDate = new Date();
    const differenceInMs =
      currentDate - new Date(oldBlog.featuredDetails.featuredAt);
    const differenceInDays = Math.floor(differenceInMs / (1000 * 60 * 60 * 24));

    if (differenceInDays > oldBlog.featuredDetails.featureDuration) {
      return res.status(400).send("Featured duration has expired");
    }
    if (oldBlog.isFree == false) {
      payment.featuredDetails.featureDuration -= differenceInDays;
      payment.featuredDetails.featuredAt = new Date();
      payment.blog = currentBlogId;
      await payment.save();
    }
    const isFree = oldBlog.isFree;
    const featureDuration = oldBlog.featuredDetails.featureDuration;
    if (oldBlog) {
      oldBlog.featured = false;
      oldBlog.isFree = false;
      oldBlog.featuredDetails.featureDuration = 0;
      oldBlog.featuredDetails.featuredEnd = new Date();
      await oldBlog.save();
    } else {
      return res.status(404).send("Current blog not found");
    }

    const currentBlog = await BlogModel.findById(currentBlogId);
    if (currentBlog) {
      currentBlog.featured = true;
      if (isFree == true) {
        currentBlog.isFree = true;
      }
      currentBlog.featuredDetails.featureDuration =
        featureDuration - differenceInDays;
      await currentBlog.save();
    } else {
      return res.status(404).send("New blog not found");
    }
    return res.json({ message: "Blog changed successfully" });
  } catch (error) {
    return res.status(500).send("Error changing blog");
  }
}

async function removeFeatured(req, res) {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  const userId = req.user._id;

  const { blogId } = req.body;
  try {
    const blog = await BlogModel.findById(blogId);
    if (blog.isFree == false) {
      const payment = await PaymentModel.findOne({
        blog: blogId,
        paymentType: "featured",
        paymentStatus: "completed",
      });

      if (!payment) {
        return res.status(404).send("Payment not found");
      }
      if (payment.user.toString() !== userId) {
        return res.status(401).send("Unauthorized");
      }
    }

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    blog.featured = false;
    blog.isFree = false;
    blog.featuredDetails.featuredEnd = new Date();
    await blog.save();
    res.status(200).send("Blog featured status removed successfully");
  } catch (error) {
    res.status(500).send("An error occurred while updating the blog");
  }
}

module.exports = {
  createPayment,
  paymentSuccess,
  paymentCancel,
  searchPayment,
  changeBlog,
  removeFeatured,
};
