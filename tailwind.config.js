/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        linen: "#F6F3EF",
        surface: "#FFFFFF",
        ink: "#111827",
        muted: "#6B7280",
        primary: "#3D5AFE",
        primary2: "#304FFE",
        sage: "#E2F1EB",
        sageInk: "#1C594A",
      },
      borderRadius: { card: "16px", btn: "12px" },
      boxShadow: {
        e1: "0 4px 16px rgba(17,24,39,.06)",
        e2: "0 8px 28px rgba(17,24,39,.08)",
      },
    },
  },
  plugins: [],
}
