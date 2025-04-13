const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

router.post('/create', paymentController.createPayment);

router.get('/success', paymentController.paymentSuccess);

router.get('/cancel', paymentController.paymentCancel);

router.get("/search", paymentController.searchPayment);

router.patch("/changeFeatured",paymentController.changeBlog);

router.patch("/featured/remove",paymentController.removeFeatured);
module.exports = router;