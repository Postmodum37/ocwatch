/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        'text-primary': '#c9d1d9',
        'text-secondary': '#8b949e',
        accent: '#58a6ff',
        success: '#238636',
        warning: '#d29922',
        error: '#f85149',
      },
    },
  },
  plugins: [],
}
