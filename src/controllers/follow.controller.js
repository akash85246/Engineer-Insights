const UserModel = require("../models/User.model");
const { createNotification } = require("./notification.controller");

async function followandunfollow(req, res) {
  try {
   const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({message: "Unauthorized" });
    }
    const userId = req.user._id;

    const slug = req.params.slug;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const author = await UserModel.findOne({ slug });

    if (!author) {
      return res.status(400).json({ error: "Author not found" });
    }

    if (user.following.includes(author._id)) {
      user.following.pull(author._id);

      author.followers.pull(userId);

      await user.save();
      await author.save();

      return res
        .status(200)
        .json({ message: "Successfully unfollowed the author" });
    }

    user.following.push(author._id);

    author.followers.push(userId);

    const notificationData = {
      user: author._id,
      notificationType: "new_follower",
      subject: `New follower`,
      message: `${user.username} started following you`,
    };

    const notificationResponse = await createNotification(notificationData);

    await user.save();
    await author.save();
    return res
      .status(200)
      .json({ message: "Successfully followed the author" });
  } catch (error) {
    console.error("Error in follow function:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function getfollowers(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const slug = req.params.slug;

    const user = await UserModel.findOne({ slug });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const followers = await UserModel.find({ _id: { $in: user.followers } })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalFollowers = user.followers.length;

    return res.status(200).json({
      followers,
      totalFollowers,
      page,
      totalPages: Math.ceil(totalFollowers / limit),
    });
  } catch (error) {
    console.error("Error in getfollowers function:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function getfollowing(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const following = await UserModel.find({ _id: { $in: user.following } })
      .skip(skip)
      .limit(limit)
      .lean();


    const totalFollowing = user.following.length;

    return res.status(200).json({
      following,
      totalFollowing,
      page,
      totalPages: Math.ceil(totalFollowing / limit),
    });
  } catch (error) {
    console.error("Error in getfollowing function:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

async function removefollower(req, res) {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user._id;
    const slug = req.params.slug;

    const user = await UserModel.findById(userId);
    const follower = await UserModel.findOne({ slug });

    if (!user || !follower) {
      return res.status(400).json({ error: "User or follower not found" });
    }

    user.followers.pull(follower._id);
    follower.following.pull(userId);

    await user.save();
    await follower.save();
    return res
      .status(200)
      .json({ message: "Successfully removed the follower" });
  } catch (error) {
    console.error("Error in removefollower function:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  followandunfollow,
  getfollowing,
  getfollowers,
  removefollower,
};
