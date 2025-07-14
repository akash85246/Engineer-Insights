const express = require("express");
const router = express.Router();
const newsletterController = require('../controllers/newsletter.controller');


router.post("/", newsletterController.subscribe);

module.exports = router;