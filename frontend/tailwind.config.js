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
        /** TV dashboard: gentle entrance (GPU-friendly). */
        'tv-section-in': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        /** TV dashboard: slow emphasis on status emoji. */
        'tv-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        /** TV dashboard: soft shimmer on hero mesh. */
        'tv-shimmer': {
          '0%, 100%': { opacity: '0.08', transform: 'translate(0, 0) scale(1)' },
          '50%': { opacity: '0.14', transform: 'translate(8px, -4px) scale(1.05)' },
        },
      },
      animation: {
        'cycle-active-blink': 'cycle-active-blink 1.2s ease-in-out infinite',
        'tv-section-in': 'tv-section-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) both',
        'tv-breathe': 'tv-breathe 3.5s ease-in-out infinite',
        'tv-shimmer': 'tv-shimmer 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}