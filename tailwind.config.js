/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          violet: '#6C4BFF',
          violetLight: '#A58BFF',
        },
        accent: {
          scarlet: '#FF4B5C',
          skyBlue: '#8EC5FC',
          pink: '#E0AFFF',
        },
        text: {
          main: '#1E1E1E',
          secondary: '#6B6B6B',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.7)',
          whiteStrong: 'rgba(255, 255, 255, 0.8)',
          cta: 'rgba(255, 255, 255, 0.2)',
        }
      },
      fontFamily: {
        'playfair': ['Playfair Display', 'serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'hero': ['30px', { lineHeight: '36px', fontWeight: '700' }],
        'section': ['21px', { lineHeight: '28px', fontWeight: '600' }],
        'body-main': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-secondary': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'cta': ['18px', { lineHeight: '24px', fontWeight: '600' }],
      },
      spacing: {
        '35': '8.75rem', // 140px for toggle width
        '50': '12.5rem', // 200px for progress circle
      },
      animation: {
        'shimmer': 'shimmer 6s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}