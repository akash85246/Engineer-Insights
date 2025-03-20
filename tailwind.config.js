/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./views/**/*.{ejs,js,html}", "./public/**/*.{ejs,js,html}"],
  theme: {
    extend: {
      boxShadow: {
        'white-lg': '0 4px 6px rgba(255, 255, 255, 0.2)',
        'white-md': '0 2px 4px rgba(255, 255, 255, 0.2)',
      },
      fontFamily: {
        roboto: ["Roboto", "sans-serif"],
        lora:["Lora", "serif"],
      },
      fontSize: {
        xxs: "0.625rem",
        xxxs: "0.5rem",
        xxxxs: "0.35rem",
        xxxxxs: "0.25rem",
        xxxxxxs: "0.15rem",
        xxxxxxxs: "0.1rem",
        xxxxxxxxs: "0.05rem",
        xxxxxxxxxs: "0.08rem",
        xxxxxxxxxxs: "0.05rem",
      },
      colors: {
        primary: {
          DEFAULT: "#212529",
        },
        secondary: {
          DEFAULT: "#343A40",
        },
        tertiary: {
          DEFAULT: "#495057",
        },
        fourth:{
          DEFAULT: "#6C757D",
        },
        fifth:{
          DEFAULT: "#C4C4C4",
        },
        sixth:{
          DEFAULT: "#E5E5E5",
        },
        highlight:{
          DEFAULT: "#D4A373",
        },
        background: "#ffffff",
        text: "#000000",
        // Dark Mode Colors
        "dark-primary": {
           DEFAULT: "#E5E5E5",
        },
        "dark-secondary": {
          DEFAULT: "#C4C4C4",
        },
        "dark-tertiary": {
          DEFAULT: "#6C757D",
        },
        "dark-fourth": {
          DEFAULT: "#495057",
        },
        "dark-fifth": {
          DEFAULT: "#343A40",
        },
        "dark-sixth": {
         DEFAULT: "#212529",
        },
        "dark-background": "#222831",
        "dark-text": "#FFFFFF",
      },
    },
  },
  plugins: [],
};
