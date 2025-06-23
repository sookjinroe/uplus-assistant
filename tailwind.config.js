/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', '"Helvetica Neue"', '"Segoe UI"', '"Apple SD Gothic Neo"', '"Noto Sans KR"', '"Malgun Gothic"', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', 'sans-serif'],
      },
      colors: {
        primary: '#475569',
        secondary: '#64748B',
        light: '#F1F5F9',
        dark: '#334155',
        text: '#0F172A',
        success: '#059669',
        warning: '#D97706',
        error: '#DC2626',
        info: '#0284C7',
        background: '#FFFFFF',
        border: '#E2E8F0',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};