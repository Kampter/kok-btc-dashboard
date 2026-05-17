import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        card: '#1e293b',
        'card-foreground': '#f8fafc',
        primary: '#e94560',
        'primary-foreground': '#ffffff',
        muted: '#334155',
        'muted-foreground': '#94a3b8',
        border: '#334155',
        ring: '#e94560',
        call: '#4ade80',
        put: '#e94560',
      },
    },
  },
  plugins: [],
} satisfies Config;
