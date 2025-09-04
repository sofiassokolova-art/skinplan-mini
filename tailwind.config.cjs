/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Manrope", "Inter", "ui-sans-serif"],
      },
      borderRadius: {
        pill: "999px",
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(2,6,23,.06)",
        pill: "0 8px 20px rgba(79,70,229,.18)",
      },
      colors: {
        ink: "#0F172A",
        mute: "#475569",
      },
    },
  },
  plugins: [],
}

