/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0a0d14',
          sidebar: '#0e131f',
          surface: '#141a29',
          border: '#1f293d',
          accent: '#00d2ff',
          success: '#10b981',
          warning: '#f59e0b',
          text: '#e2e8f0',
          muted: '#818cf8',
        }
      }
    },
  },
  plugins: [],
}
