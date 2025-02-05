// controllers/mailer.js

const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");
const ENV = require("../../config/development/config");

const nodeConfig = {
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: ENV.EMAIL,
    pass: ENV.PASSWORD,
  },
};

const transporter = nodemailer.createTransport(nodeConfig);

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "Engineer Insights",
    link: "https://engineerinsights.com/",
  },
});

const registerMail = async (req, res) => {
  try {
    const { username, userEmail, text, subject } = req.body;

    
    const email = {
      body: {
        name: username,
        intro: text,
        outro: "Need help? Reply to this email.",
      },
    };

   
    const emailBody = mailGenerator.generate(email);

    const mailOptions = {
      from: ENV.EMAIL,
      to: userEmail,
      subject: subject || "Signup successful",
      html: emailBody,
    };

    await transporter
      .sendMail(mailOptions)
      .then(() => {
        return res.status(200).send({ message: "Email sent successfully" });
      })
      .catch((err) => {
        return res.status(500).send({ error: err.message });
      });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).send({ error: "Internal server error" });
  }
};

module.exports = { registerMail };