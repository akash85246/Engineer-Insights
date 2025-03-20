const { google } = require("googleapis");
require("dotenv").config();

const analyticsDataClient = google.analyticsdata({
  version: "v1beta",
  auth: process.env.GOOGLE_ANALYTICS_API_KEY,
});

async function fetchUserAnalytics(userId, propertyId) {
  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }, { name: "deviceCategory" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: {
          filter: {
            fieldName: "customEvent:user_id",
            stringFilter: { matchType: "EXACT", value: userId },
          },
        },
      },
    });

    return response.data.rows || [];
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return [];
  }
}

module.exports = { fetchUserAnalytics };