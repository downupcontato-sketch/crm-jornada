import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        petroleo: '#071C23',
        menta: { light: '#00B0A8', DEFAULT: '#1C7D75', dark: '#004F4A' },
        offwhite: '#FFFCF2',
        cinza: '#EDF0F0',
        primary: { DEFAULT: '#00B0A8', foreground: '#071C23' },
        background: '#071C23',
        foreground: '#FFFCF2',
        card: { DEFAULT: '#0D2B35', foreground: '#FFFCF2' },
        border: '#1C3D4A',
        input: '#1C3D4A',
        ring: '#00B0A8',
        muted: { DEFAULT: '#1C3D4A', foreground: '#94A3B8' },
        accent: { DEFAULT: '#1C7D75', foreground: '#FFFCF2' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFCF2' },
      },
      fontFamily: { sans: ['Montserrat', 'system-ui', 'sans-serif'] },
      borderRadius: { lg: '0.75rem', md: '0.5rem', sm: '0.375rem' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-in': 'fade-in 0.2s ease-out' },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
