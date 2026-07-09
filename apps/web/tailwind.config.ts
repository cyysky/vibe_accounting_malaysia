import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          500: '#1d6cd6',
          600: '#1559b3',
          700: '#0f468f',
        },
      },
    },
  },
  plugins: [],
};
export default config;
