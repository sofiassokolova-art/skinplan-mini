/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Премиальная палитра SkinIQ - точные цвета из ТЗ
        pearl: {
          light: "#F9F6F3", // новый светлый перламутровый
          rose: "#F5E6E8",   // новый розовый перламутровый
          card: "#F5F1ED",   // молочный белый для карточек
        },
        text: {
          primary: "#000000",   // чистый черный для заголовков
          secondary: "#666666", // серый для подзаголовков
        },
        accent: "#E6CADF", // розово-лиловый акцент
        accent2: "#D6BCE2", // лиловый для чеков и прогресса
        progress: {
          from: "#E4D3FF", // начало градиента прогресса
          to: "#F8D8E7",   // конец градиента прогресса
        },
        button: {
          from: "#FADADD", // начало градиента кнопки
          to: "#F6EAEF",   // конец градиента кнопки (обновлен)
        },
        // Цвета для иконок задач
        task: {
          cleanser: "#9B8AA3", // лилово-серый для очистки
          serum: "#A8D8EA",    // светлый голубой для сыворотки
          cream: "#F4D4BA",    // бежево-розовый для крема
          spf: "#F2C94C",      // золотистый для SPF
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
        'sans': ['SF Pro Display', 'Inter', 'Neue Haas Grotesk', 'system-ui', 'sans-serif'],
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
        'pearl-gradient': 'linear-gradient(to bottom, #F9F6F3, #F5E6E8)',
        'button-gradient': 'linear-gradient(135deg, #FADADD, #F6EAEF)',
        'progress-gradient': 'linear-gradient(135deg, #E4D3FF, #F8D8E7)',
        'card-gradient': 'linear-gradient(135deg, #F5F1ED, #F9F6F3)',
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
