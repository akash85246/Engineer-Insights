const express = require("express");
const router = express.Router();
const contactController = require('../controllers/contact.controller');


router.post("/api/contact", contactController.contact);

module.exports = router;