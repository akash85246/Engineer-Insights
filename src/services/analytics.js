const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];
const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix newline formatting
    SCOPES
);

const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth
});

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;

async function getAnalyticsData() {
    try {
        const response = await analyticsData.properties.runReport({
            property: `properties/${GA4_PROPERTY_ID}`,
            requestBody: {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
                dimensions: [{ name: 'pageTitle' }],
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        return null;
    }
}

module.exports = { getAnalyticsData };