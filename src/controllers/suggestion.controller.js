const jwt = require("jsonwebtoken");
const { getSuggestion } = require("../services/getSuggestion");
const UserModel = require("../models/User.model");
const BlogModel = require("../models/Blog.model");

async function createSuggestion(req, res) {
 if(!req.isAuthenticated()){
   return res.status(401).json({error: "Unauthorized"})
  }

  const userId = req.user._id;
  console.log(userId);
  let { prompt } = req.body;

  prompt =
    "Suggest precisely the next three words to follow this sentence in a blog:" +
    prompt +
    "Do not include any extra words or variations; provide only the next three.";

  const user = await UserModel.findById(userId).select("settings");

  if (user && user.settings.suggestions == "false") {
    return res.end();
  }

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    let suggestion = await getSuggestion(prompt);
    suggestion = suggestion.trim().split(" ").slice(-3).join(" ");
    res.status(200).json({ suggestion });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error generating suggestion" });
  }
}

async function getSummarry(req, res) {
  if(!req.isAuthenticated()){
    return res.status(200).json({ summary : "You are not logged in" });
    }
  const userId =req.user._id;
  console.log(userId);
  let { blogId } = req.body;

  console.log("blog id", blogId);
  const blog = await BlogModel.findById(blogId).select("sanitizedHtml");

  prompt = "Give me a detailed summary:" + blog.sanitizedHtml;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const summary = await getSuggestion(prompt);
    res.status(200).json({ summary });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error generating suggestion" });
  }
}

module.exports = { createSuggestion, getSummarry };
