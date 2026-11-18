import type { Config } from 'tailwindcss';

// Paconia: every colour comes from the logo. Logo blue (#2EA7E0) carries actions, logo green (#A3CC39) carries
// "done / good", and the blue→green swoosh is used in one place only (the instant-price panel).
const config: Config = {
  safelist: ['tone-good', 'tone-warn', 'tone-bad', 'tone-info', 'tone-muted'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F7F9',
        card: '#FFFFFF',
        mist: '#E9F0F3',
        line: { DEFAULT: '#D9E3E8', strong: '#BFCDD4' },
        ink: { DEFAULT: '#14303B', soft: '#4B6370', faint: '#7D919A' },
        sky: { 50: '#EBF7FD', 100: '#CFEBF8', 300: '#7FCBEE', 400: '#2EA7E0', 500: '#1E93CB', 600: '#17799F', 700: '#125F7E' },
        leaf: { 50: '#F3F9E5', 100: '#E2F0C2', 300: '#A3CC39', 500: '#7FA82A', 600: '#5F8A16', 700: '#4A6C11', 800: '#37500C' },
        teal: { 400: '#69B6A6' },
      },
      fontFamily: {
        display: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Figtree Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: '10px', xl: '14px', '2xl': '20px' },
      boxShadow: {
        card: '0 1px 0 rgba(20,48,59,0.04)',
        lift: '0 12px 40px -12px rgba(20,48,59,0.28)',
        menu: '0 18px 48px -16px rgba(20,48,59,0.35), 0 0 0 1px rgba(20,48,59,0.06)',
      },
      backgroundImage: { swoosh: 'linear-gradient(120deg, #2EA7E0 0%, #69B6A6 52%, #A3CC39 100%)' },
    },
  },
  plugins: [],
};
export default config;
