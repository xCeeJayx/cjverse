/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          dark: '#0b0f19',
          card: '#0f172a',
          accent: '#1e293b',
          gold: '#ffd700',
          crimson: '#e11d48',
          mana: '#38bdf8',
          hp: '#22c55e',
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'confetti': 'confettiFall 4s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.6))' },
          '50%': { opacity: 0.7, filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.2))' },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-10%) rotate(0deg)', opacity: 1 },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: 0 },
        },
      },
    },
  },
  plugins: [],
};
