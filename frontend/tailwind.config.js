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
      },
      keyframes: {
        // Whole-card cue for active cycle (opacity + border); not gated on prefers-reduced-motion
        // so shop-floor tablets still blink even when OS “animation effects” is off.
        'cycle-active-blink': {
          '0%, 100%': { opacity: '1', borderColor: 'rgb(233 213 255)' },
          '50%': { opacity: '0.4', borderColor: 'rgb(126 34 206)' },
        },
      },
      animation: {
        'cycle-active-blink': 'cycle-active-blink 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}