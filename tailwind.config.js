/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial, print-inspired palette. "ink" and "paper" carry the UI;
        // "accent" is used sparingly so the *generated* colour swatches stay
        // the most vivid thing on screen, since colour is the whole product.
        ink: '#1C1A17',
        'ink-soft': '#6B655C',
        paper: '#F3EFE6',
        surface: '#FFFFFF',
        hairline: '#DDD5C7',
        accent: '#6E2A35',
        'accent-soft': '#F4E4E2',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '72rem',
      },
    },
  },
  plugins: [],
}
