export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tokyo: {
          'bg-dark': '#24283b',
          'bg-light': '#e1e2e7',
          'red-dark': '#f7768e',
          'red-light': '#db4b4b',
          'green-dark': '#9ece6a',
          'green-light': '#9ece6a',
          'teal-dark': '#73daca',
          'teal-light': '#2ac3de',
          'yellow-dark': '#e0af68',
          'yellow-light': '#ffc777',
          'blue-dark': '#7aa2f7',
          'blue-light': '#7aa2f7',
          'cyan-dark': '#7dcfff',
          'cyan-light': '#2ac3de',
          'white-dark': '#c0caf5',
          'white-light': '#1a1b26',
          'magenta-dark': '#bb9af7',
          'magenta-light': '#bb9af7',
          'grey-dark': '#a9b1d6',
          'grey-light': '#414868',
          'black-dark': '#414868',
          'black-light': '#cfc9c2',
          'border-dark': '#565f89',
          'border-light': '#a9b1d6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
}
