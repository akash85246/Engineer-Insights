const NewsletterModel = require('../models/Newsletter.model');

async function subscribe(req, res) {
    try {
        const { email } = req.body;

        const newSubscription = new NewsletterModel({
            email
        });
        await newSubscription.save();
        return res.status(201).send("Subscribed successfully!");
    } catch (error) {
        console.error("Error subscribing:", error);
        return res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    subscribe,
}