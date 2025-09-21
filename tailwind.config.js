/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Премиальная палитра SkinIQ Daylight Pearl
        pearl: {
          light: "#F7F3EF", // жемчужно-бежевый
          rose: "#F9E3E5",   // пудрово-розовый
          card: "#F5F1ED",   // молочный белый для карточек
        },
        text: {
          primary: "#1C1C1C",   // глубокий чёрный для заголовков
          secondary: "#7A7A7A", // тёплый серый для описаний
        },
        accent: "#E6CADF", // розово-лиловый акцент
        accent2: "#D6BCE2", // лиловый для чеков и прогресса
        button: {
          from: "#FADADD", // начало градиента кнопки
          to: "#F7F3EF",   // конец градиента кнопки
        },
        // Совместимость со старыми стилями
        linen: "#F7F3EF",
        surface: "#F5F1ED",
        ink: "#1C1C1C",
        muted: "#7A7A7A",
        primary: "#E6CADF",
        primary2: "#FADADD",
      },
      fontFamily: {
        'serif': ['Playfair Display', 'serif'],
        'sans': ['Inter', 'Neue Haas Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: { 
        card: "16px", 
        btn: "20px", // капсулы для кнопок
        input: "12px"
      },
      boxShadow: {
        // Эндоморфизм - мягкие выпуклые тени
        neumorphism: "8px 8px 16px rgba(230, 202, 223, 0.2), -8px -8px 16px rgba(255, 255, 255, 0.8)",
        "neumorphism-inset": "inset 4px 4px 8px rgba(230, 202, 223, 0.2), inset -4px -4px 8px rgba(255, 255, 255, 0.8)",
        glow: "0 0 20px rgba(230, 202, 223, 0.3)",
        e1: "0 4px 16px rgba(28, 28, 28, 0.04)",
        e2: "0 8px 28px rgba(28, 28, 28, 0.06)",
      },
      backgroundImage: {
        'pearl-gradient': 'linear-gradient(to bottom, #F7F3EF, #F9E3E5)',
        'button-gradient': 'linear-gradient(135deg, #FADADD, #F7F3EF)',
        'card-gradient': 'linear-gradient(135deg, #F5F1ED, #F7F3EF)',
      },
      spacing: {
        // Отступы согласно гайду
        'section': '32px', // между секциями
        'element': '24px',  // между элементами UI
        'text': '16px',     // между заголовком и описанием
      },
    },
  },
  plugins: [],
}
