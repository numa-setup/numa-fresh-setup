/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#3FB196',
        'primary-pale': '#E8F7F3',
        'primary-dark': '#2D8A76',
        gold: '#D4AF37',
      },
      fontFamily: {
        heading: ['PlayfairDisplay_700Bold'],
        body: ['Inter_400Regular'],
        'body-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
