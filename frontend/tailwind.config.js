/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: '#0D1B1E',
        secondary: '#142428',
        card: '#1A2F35',
        accent: '#2EC4B6',
        'accent-dim': '#1A7A70',
        gold: '#E8B931',
        coral: '#FF6B6B',
      },
    },
  },
  plugins: [],
};
