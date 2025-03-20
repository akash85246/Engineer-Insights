const { GoogleGenerativeAI } = require("@google/generative-ai");



const apiKey = process.env.GOOGLE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function getSuggestion(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { getSuggestion };

