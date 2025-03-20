// controllers/mailer.js

const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");

const nodeConfig = {
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_Password,
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

    console.log("username", username, "userEmail", userEmail, "text", text,"email",process.env.EMAIL,"EMAIL_Password",process.env.EMAIL_Password);
    
    const email = {
      body: {
        name: username,
        intro: text,
        outro: "Need help? Reply to this email.",
      },
    };

   
    const emailBody = mailGenerator.generate(email);

    const mailOptions = {
      from: process.env.EMAIL,
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