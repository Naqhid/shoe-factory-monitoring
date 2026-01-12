/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        running: '#22C55E',
        idle: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
      }
    },
  },
  plugins: [],
}