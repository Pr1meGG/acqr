/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
        label: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Backgrounds
        base:       '#020817',
        'base-2':   '#060d1f',
        surface:    '#0b1530',
        'surface-2':'#0d1a38',
        'surface-3':'#111f42',

        // Borders
        border:     '#1a2748',
        'border-2': '#243460',

        // Brand accents — indigo + cyan neon
        indigo: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
        primary:        '#6366f1',
        'primary-dim':  '#4f46e5',
        'primary-glow': 'rgba(99,102,241,0.25)',

        // Semantic
        success:        '#10b981',
        'success-glow': 'rgba(16,185,129,0.2)',
        warning:        '#f59e0b',
        'warning-glow': 'rgba(245,158,11,0.2)',
        error:          '#f43f5e',
        'error-glow':   'rgba(244,63,94,0.2)',

        // Text
        text:          '#e2e8f0',
        'text-muted':  '#64748b',
        'text-dim':    '#2d3f66',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)`,
        'glow-radial-indigo': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)',
        'glow-radial-cyan':   'radial-gradient(ellipse 60% 40% at 80% 120%, rgba(6,182,212,0.1), transparent)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-out-right':'slideOutRight 0.3s cubic-bezier(0.4,0,0.2,1) forwards',
        'slide-in-up':    'slideInUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':        'fadeIn 0.25s ease-out',
        'glow-pulse':     'glowPulse 2.5s ease-in-out infinite',
        'shimmer':        'shimmer 2s linear infinite',
        'pulse-soft':     'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%':   { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(16px)' },
        },
        slideInUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(99,102,241,0.35), 0 0 60px rgba(99,102,241,0.1)',
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.35), 0 0 60px rgba(6,182,212,0.1)',
        'glow-red':    '0 0 16px rgba(244,63,94,0.35)',
        'glow-green':  '0 0 16px rgba(16,185,129,0.35)',
        'card':        '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        'panel':       '0 0 0 1px rgba(99,102,241,0.15), 0 20px 60px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
