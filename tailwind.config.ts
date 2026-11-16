import type { Config } from 'tailwindcss';

// Paconia: print-studio neutrals with a green bias, logo leaf-green for actions,
// logo sky-blue for information, and the OKI's five toners (C, M, Y, K + White) as the brand device.
const config: Config = {
  safelist: ['tone-good', 'tone-warn', 'tone-bad', 'tone-info', 'tone-muted'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F7F4',
        card: '#FFFFFF',
        mist: '#EEF1EC',
        line: { DEFAULT: '#DDE3DD', strong: '#C5CEC6' },
        ink: { DEFAULT: '#13201C', soft: '#55625D', faint: '#87938D' },
        leaf: { 50: '#F2F8E6', 100: '#E2EFC6', 300: '#A5CE3A', 500: '#6A9A1F', 600: '#4F7D14', 700: '#3D6210', 800: '#2E4A0C' },
        sky: { 50: '#E9F6FC', 100: '#CDEBF8', 400: '#32A8DF', 600: '#1679A8', 700: '#125F84' },
        toner: { c: '#00A3D9', m: '#D6197A', y: '#F2C200', k: '#13201C' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Onest Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Onest Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '12px', '2xl': '18px' },
      boxShadow: {
        card: '0 1px 2px rgba(19,32,28,0.05), 0 4px 16px rgba(19,32,28,0.05)',
        lift: '0 2px 4px rgba(19,32,28,0.06), 0 12px 32px rgba(19,32,28,0.10)',
      },
    },
  },
  plugins: [],
};
export default config;
