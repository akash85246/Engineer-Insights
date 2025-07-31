[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br /> 
<div align="center">
  <a href="https://github.com/akash85246/Engineer-Insights">
    <img src="./public/images/logoImg/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Engineer-Insights</h3>

  <p align="center">
   An engaging markdown-based blogging platform that provides engineers a space to share their engineering journey, daily experiences, and technical insights.
    <br />
    <a href="https://github.com/akash85246/Engineer-Insights/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/akash85246/Engineer-Insights/issues/new?labels=enhancement">Request Feature</a>
    .
    <a href="https://github.com/akash85246/Engineer-Insights/blob/main/CONTRIBUTING.md">Contribute</a>
    .
    <a href="https://github.com/akash85246/Engineer-Insights/pulls">Pull Requests</a>
    .
    <a href="https://github.com/akash85246/Engineer-Insights/security">Report Security Issue</a>
    .
    <a href="https://github.com/akash85246/Engineer-Insights/fork">Fork the Project</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#features">Features</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#additional-notes">Additional Notes</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

[![Product Name Screen Shot][product-screenshot]](https://engineer-insights.onrender.com/)

A markdown-based blogging platform built for engineers to document and share their technical journey, day-to-day experiences, and innovative ideas. Engineer Insights empowers users with AI-assisted writing, real-time analytics, collaboration tools, and content monetization features — all crafted to enhance engineering communication and content reach.

Built with Node.js, EJS templating, and PostgreSQL. Integrated with Google services for authentication and AI-powered content support.

### Features

- **Google Authentication**: Seamless and secure login using your Google account.
- **AI-Powered Writing & Summarization**: Leverage Google AI Studio to help draft and summarize blogs effectively.
- **Blog Monetization (Featured Blogs)**: PayPal integration allows users to promote their blog by featuring it for 7 or 30 days.
- **Subscription Model**: Users can subscribe to exclusive content with two tiers — _Elite_ and _Pro_.
- **Advanced Blog Analytics Dashboard**: Get personalized insights like blog reach, best-performing time zones, country-wise readership, and more.
- **Collaboration Tools**: Co-author blogs with fellow engineers and streamline team writing efforts.
- **Blog Visibility Options**:
  - _Public_: Visible to everyone.
  - _Private_: Only visible to the author.
  - _Subscribers Only_: Restricted to subscribed users.
- **Blog Management Tools**:
  - Like, save, archive, delete, report, and share blogs easily.
- **Clean Responsive Design**: Built with modern CSS practices for desktop and mobile usability.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![Node.js][Node.js]][Node-url]
- [![Express.js][Express.js]][Express-url]
- [![PostgreSQL][Postgres]][Postgresql-url]
- [![EJS][EJS]][EJS-url]
- [![Tailwind CSS][TailwindCSS]][TailwindCSS-url]
- [![Google Auth][GoogleAuth]][GoogleAuth-url]
- [![Google AI Studio][GoogleAI]][GoogleAI-url]
- [![PayPal SDK][PayPal]][PayPal-url]
- [![Cloudinary][Cloudinary]][Cloudinary-url]
- [![Socket.IO][SocketIO]][SocketIO-url]
- [![Render][Render]][Render-url]
- [![Git][Git]][Git-url]
- [![GitHub][GitHub]][GitHub-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these simple example steps.

### Prerequisites

Before you begin, ensure the following tools and services are installed and set up on your system:

- **Node.js**: [Download Node.js](https://nodejs.org/) – LTS version recommended for stability.
- **PostgreSQL**: Install and configure PostgreSQL for managing the platform's relational data. [Download PostgreSQL](https://www.postgresql.org/download/)
- **npm or yarn**: Comes with Node.js; used to install project dependencies.
- **Git**: [Download Git](https://git-scm.com/) to clone and manage the repository.
- **Render Account**: Required for deploying the backend or frontend. Sign up at [Render](https://render.com).
- **Google Cloud Project**:
  - Set up for **Google Authentication** and **Google AI Studio integration**.
  - Follow the [official guide](https://developers.google.com/identity) to configure OAuth 2.0 credentials.
- **PayPal Developer Account**: To enable blog monetization via featured content. Set up at [developer.paypal.com](https://developer.paypal.com).
- **Cloudinary Account**: For uploading and managing blog-related media content. [Sign up here](https://cloudinary.com/).

Ensure you also have a basic understanding of the following:

- **EJS**: Templating engine used to render dynamic views on the server side.
- **Tailwind CSS**: Utility-first CSS framework used for styling and building responsive, modern UI components.

### Installation

Follow these steps to set up the project locally:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/akash85246/Engineer-Insights.git
   cd Engineer-Insights

   ```

2. Install Dependencies
   ```sh
   npm install
   ```
3. Set Up Environment Variables

   ```env
   JWT_SECRET=
   EMAIL=
   EMAIL_PASSWORD=
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=
   PAYPAL_CLIENT_SECRET=
   GOOGLE_AI_API_KEY=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   SESSION_SECRET=
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   BASE_URL=
   USERNAME=
   PASSWORD=
   MONGODB_URI=
   PORT=8080
   GA_API_SECRET=
   GA_VIEW_ID=
   GA4_PROPERTY_ID=
   GOOGLE_PROJECT_ID=
   GOOGLE_CLIENT_EMAIL=
   GOOGLE_PRIVATE_KEY=
   ```

4. Change git remote url to avoid accidental pushes to base project

   ```sh
   git remote set-url origin github_username/repo_name
   git remote -v # confirm the changes
   ```

5. Run the Project
   ```sh
   nodemon app.js
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

Once the project is running, users can explore and interact with the following features:

1. **Google Authentication**

   - Click the "Sign In with Google" button on the homepage.
   - Securely sign in using your Google account to access your personalized dashboard.

2. **Write & Share Blogs**

   - Use the built-in markdown editor to write technical blogs.
   - Get AI-assisted writing support powered by Google AI Studio.
   - Blogs can be saved as drafts, published, or archived.

3. **Blog Visibility Options**

   - Choose who can see your blog: Public, Private, or Subscribed-only.

4. **AI-Generated Summaries**

   - Automatically generate blog summaries using Google AI Studio for quick previews and improved discoverability.

5. **Collaborate with Other Authors**

   - Invite other registered users to co-author and write blogs together in real time.

6. **Feature Blogs (Monetization)**

   - Pay via PayPal to feature your blog for 7 or 30 days and boost visibility on the platform.

7. **Explore & Discover**

   - Use advanced search with filters like tags or title.
   - View Editor’s Picks, Top Authors, and Featured Blogs on the homepage.

8. **Engage with Content**

   - Like, comment, report, save, archive, delete, and share blogs easily.
   - Social sharing enabled for each post.

9. **Analytics Dashboard**

   - Access a personal analytics board showing:
     - Blog reach & engagement.
     - Country-wise and time-wise popularity.
     - Audience insights to improve future posts.

10. **Subscription Plans**

    - Choose between _Elite_ and _Pro_ plans for exclusive content, features, and access to subscriber-only blogs.

11. **Responsive Design**
    - The platform is fully responsive and optimized for desktop, tablet, and mobile viewing.

## Additional Notes

- **Database**: Ensure that your MongoDB instance is running. Use either a local MongoDB server or a cloud-hosted solution like MongoDB Atlas. Seed initial data if required for development.
- **Deployment**: The app can be deployed to platforms like Render or Vercel. Make sure to set environment variables appropriately for production.
- **Customization**: Use the `.env` file to modify configurations such as MongoDB URI, server port, Google credentials, PayPal keys, and other integrations.
- **Media Hosting**: All media uploads (e.g., blog images) are handled via Cloudinary. Ensure that Cloudinary credentials are properly set in your environment.
- **Security**: Avoid exposing sensitive credentials or private API keys in frontend code. Use server-side logic for secure integration.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

Here are the planned improvements and features for the Engineer Insights platform:

- [x] Google Authentication for user login.
- [x] Two-Factor Authentication (2FA) for enhanced account security.
- [x] AI-assisted blog writing using Google AI Studio.
- [x] AI-generated summaries for blog posts.
- [x] Blog creation, editing, archiving, deleting, and saving as drafts.
- [x] Visibility controls: Public, Private, and Subscriber-only blogs.
- [x] Blog sharing via social media or direct link.
- [x] Collaborate with other authors to write blogs.
- [x] Monetize blogs via featured placements (7/30 days) using PayPal.
- [x] Subscription plans for exclusive content access (Elite & Pro).
- [x] Blog analytics dashboard with country-wise/time-wise insights.
- [x] User-friendly markdown editor.
- [x] Responsive design optimized for desktop and mobile.
- [x] Comment system for blog posts.
- [x] Notification system for collaborations and interactions.
- [x] Bookmark feature to save favorite blogs.
- [ ] Admin dashboard for moderating reports and managing content/users.
- [ ] Machine learning-based personalized blog recommendation system.

See the [open issues](https://github.com/akash85246/Engineer-Insights/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would improve this project, feel free to fork the repository and submit a pull request. You can also open an issue with the label `"enhancement"`.  
Don't forget to ⭐ the project — thank you for your support!

### How to Contribute

1. **Fork the Project**

   - Click the "Fork" button at the top-right corner of this page to create a copy of the repository in your GitHub account.

2. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/Engineer-Insights.git
   ```

3. **Create Your Feature Branch**

   ```bash
   git checkout -b feature/YourFeatureName
   ```

4. **Commit Your Changes**

   ```bash
   git commit -m "Add: Your descriptive feature message"
   ```

5. **Push to the Branch**

   ```bash
   git push origin feature/YourFeatureName
   ```

6. **Open a Pull Request**

   - Go to the original repository: [`akash85246/Engineer-Insights`](https://github.com/akash85246/Engineer-Insights)
   - Open a new pull request and describe the changes you’ve made.

### Top Contributors

<a href="https://github.com/akash85246/Engineer-Insights/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=akash85246/Engineer-Insights" alt="Top contributors" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Contact

Akash Rajput - [@akash_rajp91025](https://x.com/akash_rajp91025) - akash.rajput.dev@gmail.com

Project Link: [https://github.com/akash85246/Engineer-Insights](https://github.com/akash85246/Engineer-Insights)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

I would like to extend my gratitude to the following resources, tools, and individuals that made this project possible:

- **Google AI Studio** – For enabling AI-assisted writing and content summarization.
- **Google Authentication** – For secure and seamless user login.
- **MongoDB & Mongoose** – For providing a scalable and flexible database solution.
- **Cloudinary** – For effortless and reliable media storage and delivery.
- **PayPal Developer Platform** – For powering monetization through featured blog promotions.
- **Render** – For providing a simple and effective deployment solution.
- **Tailwind CSS** – For the utility-first framework that helped build a clean and responsive UI.
- **Node.js** – For being the backbone of the server-side application.
- **Express.js** – For simplifying API development and server management.
- **EJS** – For server-side templating and rendering dynamic content.
- **Socket.IO** – For enabling real-time collaboration and interactivity.
- **Loaders.css** – For lightweight and customizable loaders used during content fetch and loading screens.
- **Toastify.js** – For elegant and simple toast notifications.
- **Udemy** – For tutorials, project ideas, and technical deep-dives that helped sharpen development skills.
- **Open Source Community** – For providing libraries, tools, and inspiration to build projects like this.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/akash85246/Engineer-Insights.svg?style=for-the-badge
[contributors-url]: https://github.com/akash85246/Engineer-Insights/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/akash85246/Engineer-Insights.svg?style=for-the-badge
[forks-url]: https://github.com/akash85246/Engineer-Insights/network/members
[stars-shield]: https://img.shields.io/github/stars/akash85246/Engineer-Insights.svg?style=for-the-badge
[stars-url]: https://github.com/akash85246/Engineer-Insights/stargazers
[issues-shield]: https://img.shields.io/github/issues/akash85246/Engineer-Insights.svg?style=for-the-badge
[issues-url]: https://github.com/akash85246/Engineer-Insights/issues
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/akash-rajput-68226833a/
[product-screenshot]: ./public/images/product-screenshot/Engineer-InsightsHome.png
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Express.js]: https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[Postgres]: https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white
[Postgresql-url]: https://www.postgresql.org/
[EJS]: https://img.shields.io/badge/EJS-808080?style=for-the-badge&logo=javascript&logoColor=white
[EJS-url]: https://ejs.co/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[GoogleAuth]: https://img.shields.io/badge/Google%20Auth-4285F4?style=for-the-badge&logo=google&logoColor=white
[GoogleAuth-url]: https://developers.google.com/identity
[GoogleAI]: https://img.shields.io/badge/Google%20AI%20Studio-9A208C?style=for-the-badge&logo=google&logoColor=white
[GoogleAI-url]: https://makersuite.google.com/
[PayPal]: https://img.shields.io/badge/PayPal-003087?style=for-the-badge&logo=paypal&logoColor=white
[PayPal-url]: https://developer.paypal.com/
[Cloudinary]: https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white
[Cloudinary-url]: https://cloudinary.com/
[SocketIO]: https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white
[SocketIO-url]: https://socket.io/
[Render]: https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black
[Render-url]: https://render.com/
[Git]: https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white
[Git-url]: https://git-scm.com/
[GitHub]: https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white
[GitHub-url]: https://github.com/
