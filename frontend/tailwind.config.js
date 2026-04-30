/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        label: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        base: '#020617',
        surface: '#0a1628',
        'surface-2': '#0f1f38',
        border: '#1e2d45',
        'border-2': '#243450',
        primary: '#3b82f6',
        'primary-glow': 'rgba(59,130,246,0.15)',
        success: '#10b981',
        'success-glow': 'rgba(16,185,129,0.12)',
        warning: '#f59e0b',
        'warning-glow': 'rgba(245,158,11,0.12)',
        error: '#ef4444',
        'error-glow': 'rgba(239,68,68,0.12)',
        text: '#f1f5f9',
        'text-muted': '#64748b',
        'text-dim': '#334155',
      },
      animation: {
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(59,130,246,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(59,130,246,0.5)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59,130,246,0.25)',
        'glow-green': '0 0 20px rgba(16,185,129,0.25)',
        'glow-red': '0 0 20px rgba(239,68,68,0.25)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
