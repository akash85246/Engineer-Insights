const express = require("express");
const router = express.Router();
const suggestionController = require("../controllers/suggestion.controller.js");
const { Auth } = require("../middleware/auth");

router.post('/', suggestionController.createSuggestion);
router.post('/summary', suggestionController.getSummarry);

module.exports = router;