import type { Config } from 'tailwindcss';

const withVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: withVar('--c-canvas'),
        surface: withVar('--c-surface'),
        'surface-2': withVar('--c-surface-2'),
        line: withVar('--c-border'),
        ink: withVar('--c-ink'),
        'ink-2': withVar('--c-ink-2'),
        'ink-3': withVar('--c-ink-3'),
        cinnabar: withVar('--c-cinnabar'),
        gold: withVar('--c-gold'),
        jade: withVar('--c-jade'),
        azure: withVar('--c-azure'),
        plum: withVar('--c-plum'),
        violet: withVar('--c-violet'),
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', 'Songti SC', 'STSong', 'SimSun', 'Georgia', 'serif'],
        sans: ['"Source Han Sans SC"', '"Noto Sans SC"', 'PingFang SC', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        kai: ['"Kaiti SC"', 'STKaiti', 'KaiTi', '"Source Han Serif SC"', 'serif'],
      },
      boxShadow: {
        scroll: '0 18px 44px -22px rgb(43 33 18 / 0.35)',
        panel: '0 1px 0 0 rgb(255 255 255 / 0.5) inset, 0 10px 30px -18px rgb(48 38 22 / 0.35)',
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'flow-dash': {
          to: { strokeDashoffset: '-24' },
        },
        'ink-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ink-in': 'ink-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
