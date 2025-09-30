/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Обновленная палитра согласно дизайн-гайду
        pearl: {
          bg1: "#FDF7F6", // верх градиента фона
          bg2: "#F8EDEA", // середина градиента фона  
          bg3: "#F6E8E5", // низ градиента фона
          card: "#FCF7F5", // фон карточек
          switcher: "#F9F0ED", // фон переключателя
          bottom: "#FAF4F2", // фон нижних карточек
        },
        text: {
          primary: "#1C1C1C",   // основной текст
          secondary: "#6F6F6F", // подзаголовки
          inactive: "#8E8E8E",  // неактивный текст
          progress: "#4E4E4E",  // текст в прогрессе
        },
        // Градиенты для активных состояний
        active: {
          from: "#FBD6CF", // начало активного градиента
          to: "#F7E6E2",   // конец активного градиента
        },
        // Прогресс-бар
        progress: {
          from: "#E7C0F9", // начало градиента прогресса
          to: "#C9A3FF",   // конец градиента прогресса
        },
        // Чекбоксы
        checkbox: {
          from: "#EAC3F8", // начало градиента чекбокса
          to: "#C7A2F9",   // конец градиента чекбокса
        },
        // Иконки
        icons: {
          quiz: "#C295F9",    // сиреневый для анкеты
          cart: "#E9A2B2",    // розовый для корзины
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
        // Усиленный эндоморфизм для премиального вида
        neumorphism: "12px 12px 24px rgba(230, 202, 223, 0.15), -12px -12px 24px rgba(255, 255, 255, 0.9)",
        "neumorphism-inset": "inset 6px 6px 12px rgba(230, 202, 223, 0.15), inset -6px -6px 12px rgba(255, 255, 255, 0.9)",
        "neumorphism-subtle": "6px 6px 12px rgba(230, 202, 223, 0.1), -6px -6px 12px rgba(255, 255, 255, 0.8)",
        glow: "0 0 30px rgba(230, 202, 223, 0.4)",
        "glow-strong": "0 0 40px rgba(230, 202, 223, 0.6)",
        e1: "0 4px 16px rgba(28, 28, 28, 0.04)",
        e2: "0 8px 28px rgba(28, 28, 28, 0.06)",
      },
      backgroundImage: {
        'pearl-gradient': 'linear-gradient(to bottom, #FDFCFB, #F7F1EF)',
        'switcher-gradient': 'linear-gradient(135deg, #FDFDFD, #F7F1EF)',
        'active-gradient': 'linear-gradient(135deg, #F2C8C2, #F2C8C2)',
        'progress-gradient': 'linear-gradient(135deg, #D7A6E8, #F2C8C2)',
        'checkbox-gradient': 'linear-gradient(135deg, #D7A6E8, #F2C8C2)',
        'cta-gradient': 'linear-gradient(135deg, #F2C8C2, #E9D8E9)',
      },
      spacing: {
        // Отступы согласно гайду
        'section': '32px', // между секциями
        'element': '24px',  // между элементами UI
        'text': '16px',     // между заголовком и описанием
      },
      fontSize: {
        // Типографическая система
        'h1': ['24px', { lineHeight: '28px', fontWeight: '600' }],
        'h2': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '22px', fontWeight: '400' }],
      },
      fontFeatureSettings: {
        'numeric': '"tnum"',
      },
    },
  },
  plugins: [],
}
