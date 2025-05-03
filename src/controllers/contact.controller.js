const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");

const nodeConfig = {
  service: "gmail",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
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

async function contact(req, res) {
    const { firstName, lastName, topic, message, email, phone } = req.body;
    const fullName = `${firstName} ${lastName}`;
    const emailContent = mailGenerator.generate({
        body: {
          name: "New Contact Form Submission",
          intro: `You have received a new message from ${fullName}.`,
          table: [
            {
              data: [
                { description: "Full Name", value: fullName },
                { description: "Email", value: email },
                { description: "Phone", value: phone },
                { description: "Topic", value: topic },
                { description: "Message", value: message },
              ],
            },
          ],
          outro: "Thank you for using Engineer Insights. We will get back to you soon.",
        },
      });
  
    const mailOptions = {
      from: process.env.EMAIL,  
      to: process.env.EMAIL,  
      subject: "Contact Form Submission: " + topic,  
      html: emailContent,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).send("Error sending message");
      } else {
        console.log("Message sent: " + info.response);
        return res.status(200).send("Message sent successfully");
      }
    });
  }

module.exports = {
  contact,
};