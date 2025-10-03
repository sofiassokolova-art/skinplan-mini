import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeSkinPhoto } from "../lib/skinAnalysis";
import ModernButton from "../ui/ModernButton";

const STORAGE_KEY = "skiniq.answers";

interface Answers {
  // Основные цели для кожи
  skin_goals?: string[];
  
  // Общая информация
  age?: string;
  gender?: "Женский" | "Мужской";
  
  // Тип кожи
  skin_type?: string;
  
  // Проблемы кожи
  skin_concerns?: string[];
  
  // Сезонные изменения
  seasonal_changes?: string;
  
  // Медицинские диагнозы
  medical_diagnoses?: string[];
  pregnancy_status?: string;
  
  // Аллергии
  allergies?: string[];
  avoid_ingredients?: string[];
  
  // Рецептурные средства
  prescription_creams?: string[];
  oral_medications?: string[];
  
  // Привычки
  lifestyle_habits?: string[];
  
  // Предпочтения в уходе
  care_type?: string;
  routine_steps?: string;
  budget?: string;
  
  // Текущий уход
  makeup_frequency?: string;
  spf_use?: string;
  sun_exposure?: string;
  
  // Опыт с ретинолом
  retinol_experience?: "yes" | "no";
  retinol_reaction?: "good" | "irritation" | "dont_know";
  
  // Мотивационные вопросы
  struggle_choosing?: "yes" | "no";
  quit_complex_routine?: "yes" | "no";
  dissatisfied_mirror?: "yes" | "no";
  want_improve?: "yes" | "no";
  want_establish_routine?: "yes" | "no";
  
  // Фото (опционально)
  photo_data_url?: string | null;
  photo_analysis?: any | null;
  photo_scans?: { ts: number; preview: string; analysis: any; problemAreas?: any[] }[];
}

function loadAnswers(): Answers {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveAnswers(answers: Answers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
}

// Типы экранов
type QuestionScreen = {
  kind: "question";
  id: string;
  title: string;
  description?: string;
  type: "single" | "multi" | "photo";
  options?: string[];
  required?: boolean;
};

type InfoScreen = {
  kind: "info";
  id: string;
  title: string;
  subtitle?: string;
  visual?: "comparison" | "trust" | "testimonials" | "product_showcase" | "motivation" | "yes_no";
  renderBody: (answers: Answers) => React.ReactNode;
  ctaText?: string;
  buttons?: { text: string; value: string }[];
};

type Screen = QuestionScreen | InfoScreen;

// Компоненты для вопросов
function SingleChoice({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3 max-w-none">
      {options.map(option => {
        const isSelected = value === option;
        const lines = option.split('\n');
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`w-full p-4 rounded-2xl border transition-all duration-200 text-left ${
              isSelected 
                ? "bg-neutral-500/40 backdrop-blur-xl text-neutral-900 border-neutral-500/50 shadow-lg"
                : "bg-white/40 backdrop-blur-xl text-gray-700 border-white/50 hover:border-white/70 shadow-md hover:-translate-y-0.5"
            }`}
          >
            {lines.map((line, idx) => (
              <div key={idx} className={`font-medium ${idx === 1 ? 'text-sm opacity-70 mt-1' : ''}`}>
                {line}
              </div>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice({ options, value, onChange }: { options: string[]; value?: string[]; onChange: (v: string[]) => void }) {
  const selected = new Set(value || []);
  
  return (
    <div className="space-y-2 max-w-none">
      {options.map(option => {
        const isSelected = selected.has(option);
        return (
          <label
            key={option}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 bg-white/40 backdrop-blur-xl text-neutral-800 border border-white/50 hover:bg-white/60 shadow-md"
          >
            <div 
              className="flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                const newSelected = new Set(selected);
                if (isSelected) {
                  newSelected.delete(option);
                } else {
                  newSelected.add(option);
                }
                onChange(Array.from(newSelected));
              }}
            >
              <span
                className={`w-6 h-6 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  isSelected 
                    ? 'border-transparent bg-neutral-900 text-white scale-100' 
                    : 'border-neutral-300 bg-neutral-200 text-neutral-400 scale-95'
                }`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </div>
            <span className="flex-1 text-sm font-medium">{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function ProgressBar({ currentStepIndex }: { currentStepIndex: number }) {
  const completedQuestions = useMemo(() => {
    const questionSteps = screens.slice(0, currentStepIndex + 1).filter(step => step.kind === "question");
    // Исключаем опциональный фото-шаг из подсчёта
    return questionSteps.filter(step => step.id !== "photo").length;
  }, [currentStepIndex]);
  
  const totalRequiredQuestions = screens.filter(step => step.kind === "question" && step.id !== "photo").length;
  const percentage = Math.min(100, Math.round((completedQuestions / totalRequiredQuestions) * 100));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>Шаг {completedQuestions} из {totalRequiredQuestions}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-neutral-200 rounded">
        <div 
          className="h-2 bg-black rounded" 
          style={{ width: `${percentage}%` }}
          aria-label="Прогресс анкеты"
        />
      </div>
    </div>
  );
}

// Определение всех экранов анкеты
const screens: Screen[] = [
  // 1. Экран приветствия
  {
    kind: "info",
    id: "welcome",
    title: "Skin-plan mini",
    subtitle: "Подбери уход для своей кожи",
    renderBody: () => (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">Как это работает?</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">1️⃣</span>
              <span>Ответьте на несколько вопросов</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">2️⃣</span>
              <span>Загрузите фото</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">3️⃣</span>
              <span>Получите персональную подборку ухода</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">4️⃣</span>
              <span>Посмотрите как будет выглядеть кожа уже через 12 недель применения средств</span>
            </div>
          </div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 2. Персональный анализ кожи
  {
    kind: "info",
    id: "personal_analysis",
    title: "⭐ SkinIQ — ваш персональный анализ кожи",
    renderBody: () => (
      <div className="space-y-4">
        <div className="text-sm font-medium">Ваш полный анализ включает:</div>
        <div className="space-y-2 text-sm">
          <div>🔍 Детальный разбор — морщины, линии и текстура в 3D</div>
          <div>💧 Уровень увлажнённости — персональная оценка баланса влаги</div>
          <div>🔬 Поры — точное выявление и измерение</div>
          <div>💚 Здоровье кожи — покраснения, воспаления, раздражения</div>
        </div>
        <div className="mt-4 space-y-1 text-xs">
          <div>✅ 92% пользователей отмечают улучшение состояния кожи за 1 месяц</div>
          <div>✅ SkinIQ в 3 раза эффективнее обычных рутин</div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 3. Цели для кожи
  {
    kind: "info",
    id: "goals_intro",
    title: "Расскажите нам о вашей цели",
    subtitle: "Каждое большое изменение начинается с чёткой цели",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 4. Вопрос о целях
  {
    kind: "question",
    id: "skin_goals",
    title: "Какие ваши основные цели для кожи?",
    type: "multi",
    options: [
      "Морщины и мелкие линии",
      "Акне и высыпания",
      "Сократить видимость пор",
      "Уменьшить отёчность",
      "Выровнять пигментацию",
      "Улучшить текстуру кожи"
    ],
    required: true
  },

  // 5. Отзывы
  {
    kind: "info",
    id: "testimonials",
    title: "✨ Тысячи людей уже добились здоровой и красивой кожи с нами",
    subtitle: "Персональный уход, который решает именно вашу задачу",
    visual: "testimonials",
    renderBody: () => (
      <div className="space-y-4 mt-4 overflow-x-auto">
        <div className="flex gap-4 pb-4">
          {[
            { name: "Ольга, Санкт-Петербург", text: "С помощью подобранного ухода я убрала акне и следы постакне за 3 месяца. Удобно, что можно просто загрузить фото!" },
            { name: "Дарья, Казань", text: "Моя кожа стала более упругой и увлажнённой. Приложение помогло подобрать уход, который реально работает!" },
            { name: "Ирина, Новосибирск", text: "У меня была проблема с покраснением и чувствительностью, через месяц стало намного лучше, кожа спокойнее!" },
            { name: "Екатерина, Москва", text: "Всегда мучалась с расширенными порами и жирным блеском. Теперь макияж хорошо держится, жирный блеск появляется только к концу дня" }
          ].map((review, i) => (
            <div key={i} className="min-w-[280px] p-4 bg-white/50 rounded-2xl">
              <div className="text-yellow-500 mb-2">⭐️⭐️⭐️⭐️⭐️</div>
              <p className="text-sm mb-2">«{review.text}»</p>
              <p className="text-xs text-neutral-600">— {review.name}</p>
            </div>
          ))}
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 6. Общая информация
  {
    kind: "info",
    id: "general_info_intro",
    title: "Общая информация",
    subtitle: "Поможет нам подобрать подходящий уход",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 7. Вопрос о возрасте
  {
    kind: "question",
    id: "age",
    title: "Возраст",
    type: "single",
    options: ["До 18 лет", "18–24", "25–34", "35–44", "45+"],
    required: true
  },

  // 8. Вопрос о поле
  {
    kind: "question",
    id: "gender", 
    title: "Пол",
    type: "single",
    options: ["Женский", "Мужской"],
    required: true
  },

  // 9. Узнаем особенности кожи
  {
    kind: "info",
    id: "skin_features_intro",
    title: "Узнаем особенности вашей кожи",
    subtitle: "Мы поймем какой у вас тип кожи и как о нем заботиться лучше всего",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 10. Вопрос о типе кожи
  {
    kind: "question",
    id: "skin_type",
    title: "Выберите ваш тип кожи",
    type: "single",
    options: [
      "Тип 1 — Сухая\nКожа ощущается стянутой и сухой по всей поверхности, часто вызывает дискомфорт, особенно после умывания",
      "Тип 2 — Комбинированная (сухая)\nЕсть стянутость и сухость в области скул и щёк, в Т-зоне кожа нормальная",
      "Тип 3 — Нормальная\nНет ощущения стянутости и сухости кожи, не появляется жирный блеск в Т-зоне",
      "Тип 4 — Комбинированная (жирная)\nВ области щёк и скул кожа нормальная, но в Т-зоне появляется жирный блеск",
      "Тип 5 — Жирная\nЖирный блеск присутствует во всех зонах лица. Кожа выглядит жирной и склонна к закупориванию пор"
    ],
    required: true
  },

  // 11. Вопрос о проблемах кожи
  {
    kind: "question",
    id: "skin_concerns",
    title: "Что вас больше всего беспокоит в коже сейчас?",
    description: "Можно выбрать несколько",
    type: "multi",
    options: [
      "Акне",
      "Жирность и блеск кожи",
      "Сухость и стянутость",
      "Неровный тон",
      "Пигментация",
      "Морщины, возрастные изменения",
      "Чувствительность",
      "Расширенные поры",
      "Отеки под глазами",
      "Круги под глазами",
      "В целом всё устраивает, хочу поддерживающий уход"
    ],
    required: true
  },

  // 12. Сезонные изменения
  {
    kind: "question",
    id: "seasonal_changes",
    title: "Меняется ли состояние кожи в зависимости от сезона?",
    type: "single",
    options: [
      "Летом становится жирнее",
      "Зимой суше",
      "Круглый год одинаково"
    ],
    required: true
  },

  // 13. SkinIQ делает уход простым
  {
    kind: "info",
    id: "simple_care",
    title: "SkinIQ делает уход за кожей простым и понятным",
    visual: "comparison",
    renderBody: () => (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <div className="font-semibold mb-2">Традиционный уход</div>
          <div className="text-sm space-y-1">
            <div>❌ Часы поиска советов в интернете</div>
            <div>❌ Тратить деньги на неподходящие средства</div>
            <div>❌ Результата приходится ждать месяцами</div>
          </div>
        </div>
        <div>
          <div className="font-semibold mb-2">С SkinIQ</div>
          <div className="text-sm space-y-1">
            <div>✅ Персональные рекомендации для вашего типа кожи</div>
            <div>✅ Сканируйте и отслеживайте прогресс легко</div>
            <div>✅ Видимые результаты уже через несколько недель</div>
          </div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 14. Данные о здоровье
  {
    kind: "info",
    id: "health_data",
    title: "Нам важно учесть ваши данные о здоровье",
    subtitle: "чтобы подобрать безопасный уход",
    renderBody: () => (
      <p className="text-sm text-neutral-600 text-center">
        Ваши данные защищены — они нужны только для точных рекомендаций
      </p>
    ),
    ctaText: "Продолжить"
  },

  // 15. Медицинские диагнозы
  {
    kind: "question",
    id: "medical_diagnoses",
    title: "Есть ли у вас диагнозы, поставленные врачом?",
    type: "multi",
    options: [
      "Акне",
      "Розацеа", 
      "Себорейный дерматит",
      "Атопический дерматит / сухая кожа",
      "Пигментация (мелазма)",
      "Нет"
    ],
    required: false
  },

  // 16. Беременность (только для женщин)
  {
    kind: "question",
    id: "pregnancy_status",
    title: "Вы беременны или кормите грудью?",
    type: "single",
    options: [
      "Я беременна",
      "Я кормлю грудью",
      "Нет"
    ],
    required: true
  },

  // 17. Аллергии
  {
    kind: "question",
    id: "allergies",
    title: "Отмечались ли у вас аллергические реакции на косметические или уходовые средства?",
    type: "multi",
    options: [
      "Да, на средства для ухода за кожей (кремы, сыворотки, маски и др.)",
      "Да, на декоративную косметику",
      "Да, на солнцезащитные средства",
      "Не уверен(а), но бывали раздражения",
      "Нет, реакции не отмечались"
    ],
    required: false
  },

  // 18. Исключить ингредиенты
  {
    kind: "question",
    id: "avoid_ingredients",
    title: "Выберите ингредиенты, которые вы хотели бы исключить из средств по уходу за кожей",
    description: "Выбор можно пропустить",
    type: "multi",
    options: [
      "Ретинол",
      "Витамин C",
      "Гиалуроновая кислота",
      "Ниацинамид",
      "Пептиды",
      "Церамиды",
      "Кислоты AHA/BHA (гликолевая, салициловая и др.)",
      "Минеральные масла",
      "Сульфаты (SLS, SLES)",
      "Парабены",
      "Отдушки и ароматизаторы",
      "Спирт (alcohol denat.)",
      "Такие ингредиенты отсутствуют"
    ],
    required: false
  },

  // 19. Забота о здоровье
  {
    kind: "info",
    id: "health_trust",
    title: "💙 SkinIQ заботится о вашем здоровье",
    subtitle: "Все рекомендации по уходу одобрены врачами-дерматологами и абсолютно безопасны",
    visual: "trust",
    renderBody: () => (
      <p className="text-xs text-neutral-500 text-center mt-4">
        Вся информация остаётся конфиденциальной и используется только для персональных рекомендаций
      </p>
    ),
    ctaText: "Продолжить"
  },

  // 20. Текущий уход
  {
    kind: "info",
    id: "current_care_intro",
    title: "Расскажите о вашем текущем уходе",
    subtitle: "Это поможет нам понять, какие средства вы уже используете и как реагирует ваша кожа",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 21. Опыт с ретинолом
  {
    kind: "question",
    id: "retinol_experience",
    title: "Использовали ли вы когда-либо ретинол или ретиноиды?",
    description: "Например, третиноин, адапален и др.",
    type: "single",
    options: ["Да", "Нет"],
    required: true
  },

  // 22. Реакция на ретинол
  {
    kind: "question",
    id: "retinol_reaction",
    title: "Как кожа реагировала?",
    type: "single",
    options: [
      "Хорошо переносила",
      "Появлялось раздражение или сухость",
      "Затрудняюсь ответить"
    ],
    required: true
  },

  // 23. Рецептурные кремы
  {
    kind: "question",
    id: "prescription_creams",
    title: "Применяете ли вы рецептурные кремы или гели для кожи?",
    type: "multi",
    options: [
      "Азелаиновая кислота (Skinoren, Азелик, Finacea)",
      "Антибактериальные средства (Клиндамицин — Клиндовит, Далацин; Метронидазол — Метрогил, Розамет)",
      "Ретиноиды наружные (Адапален — Дифферин, Адаклин; Изотретиноин — Изотрекс)",
      "Бензоилпероксид (Базирон АС, Эффезел)",
      "Кортикостероидные кремы/мази (Гидрокортизон, Адвантан, Локоид)",
      "Нет, не применяю"
    ],
    required: false
  },

  // 24. Пероральные препараты
  {
    kind: "question",
    id: "oral_medications",
    title: "Принимаете ли вы пероральные препараты для кожи?",
    type: "multi",
    options: [
      "Изотретиноин (Аккутан, Роаккутан и аналоги)",
      "Антибиотики (Доксициклин, Миноциклин, Эритромицин и др.)",
      "Гормональные препараты (Спиронолактон, оральные контрацептивы)",
      "Нет, не принимал(а)"
    ],
    required: false
  },

  // 25. ИИ для подбора
  {
    kind: "info",
    id: "ai_showcase",
    title: "SkinIQ использует ИИ для подбора ухода, который действительно работает",
    visual: "product_showcase",
    renderBody: () => (
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-3xl mb-2">💧</div>
            <div className="text-xs font-medium">Увлажняющий крем</div>
            <div className="text-xs text-neutral-600">Поддерживает барьер кожи</div>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">✨</div>
            <div className="text-xs font-medium">Сыворотка с витамином C</div>
            <div className="text-xs text-neutral-600">Осветляет и выравнивает тон</div>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">☀️</div>
            <div className="text-xs font-medium">Солнцезащитный крем SPF 50</div>
            <div className="text-xs text-neutral-600">Защищает от фотостарения</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-center">
          <div>95% точность рекомендаций</div>
          <div>10M+ анализов кожи по фото</div>
          <div>500+ активных ингредиентов</div>
          <div>Подтверждено дерматологами</div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 26. Привычки влияют на кожу
  {
    kind: "info",
    id: "habits_matter",
    title: "Каждая привычка отражается на коже",
    subtitle: "Давайте посмотрим, что влияет именно на вашу и как ей помочь",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 27. Вопросы о привычках
  {
    kind: "question",
    id: "makeup_frequency",
    title: "Как часто вы используете декоративную косметику?",
    type: "single",
    options: [
      "Ежедневно",
      "Иногда",
      "Почти никогда"
    ],
    required: true
  },

  // 28. SPF
  {
    kind: "question",
    id: "spf_use",
    title: "Как часто используете солнцезащитный крем?",
    type: "single",
    options: [
      "Каждый день",
      "Иногда",
      "Никогда"
    ],
    required: true
  },

  // 29. Время на солнце
  {
    kind: "question",
    id: "sun_exposure",
    title: "Сколько времени вы проводите на солнце?",
    type: "single",
    options: [
      "0–1 час в день",
      "1–3 часа в день",
      "Более 3 часов в день",
      "Не знаю"
    ],
    required: true
  },

  // 30. Привычки
  {
    kind: "question",
    id: "lifestyle_habits",
    title: "Ваши привычки (можно выбрать несколько)",
    type: "multi",
    options: [
      "Курю 🚬",
      "Употребляю алкоголь 🍷",
      "Часто не высыпаюсь 😴",
      "Испытываю стресс ⚡",
      "Ем много сладкого 🍩",
      "Ем много фастфуда 🍔",
      "Часто бываю на солнце без SPF ☀️",
      "Нет, у меня нет таких привычек ✅"
    ],
    required: false
  },

  // 31. AI подбор (сравнение)
  {
    kind: "info",
    id: "ai_comparison",
    title: "Больше никакой путаницы — AI SkinIQ подберёт уход быстро и точно ✨",
    visual: "comparison",
    renderBody: () => (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-left">
          <div className="font-semibold mb-2">Традиционный подбор ухода</div>
          <div className="text-sm space-y-1">
            <div>❌ Долгие поиски советов в интернете</div>
            <div>❌ Сложно понять, что подойдёт именно вам</div>
          </div>
        </div>
        <div className="text-left">
          <div className="font-semibold mb-2">SkinIQ с AI</div>
          <div className="text-sm space-y-1">
            <div>✅ Фотоанализ и точный подбор средств</div>
            <div>✅ Рекомендации за пару секунд</div>
          </div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 32. Предпочтения в уходе
  {
    kind: "info",
    id: "preferences_intro",
    title: "✨ Расскажите о ваших предпочтениях в уходе",
    subtitle: "Это поможет учесть ваши ожидания — какие текстуры, форматы и ощущения от ухода вам ближе",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 33. Тип ухода
  {
    kind: "question",
    id: "care_type",
    title: "Какой тип ухода вам ближе?",
    type: "single",
    options: [
      "Стандартные продукты популярных брендов",
      "Только натуральное / органическое",
      "Медицинские и аптечные средства",
      "Не знаю, хочу, чтобы подобрали"
    ],
    required: true
  },

  // 34. Шаги в уходе
  {
    kind: "question",
    id: "routine_steps",
    title: "Сколько шагов в уходе для вас комфортно?",
    type: "single",
    options: [
      "Минимум (1–3 шага)",
      "Средний (3–5 шагов)",
      "Максимум (5+ шагов)",
      "Не знаю"
    ],
    required: true
  },

  // 35. Бюджет
  {
    kind: "question",
    id: "budget",
    title: "Какой бюджет вам комфортен?",
    description: "Это поможет нам рекомендовать средства в подходящем ценовом диапазоне",
    type: "single",
    options: [
      "Бюджетный сегмент (до 2 000 ₽)",
      "Средний сегмент (2 000–5 000 ₽)",
      "Премиум-сегмент (5 000+ ₽)",
      "Без предпочтений (любой)"
    ],
    required: true
  },

  // 36. Не бояться ошибок
  {
    kind: "info",
    id: "no_mistakes",
    title: "Не нужно бояться ошибок — уход должен быть комфортным! ✨",
    renderBody: () => (
      <div className="space-y-3 mt-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>❌ Слишком много средств сразу</div>
          <div>✅ Последовательный уход шаг за шагом</div>
          <div>❌ Ожидать моментальный результат</div>
          <div>✅ Смотреть на долгосрочные изменения</div>
          <div>❌ Копировать чужой уход</div>
          <div>✅ Подбор под особенности вашей кожи</div>
        </div>
        <p className="text-xs text-neutral-600 text-center mt-4">
          Мы поможем выстроить уход, который работает именно для вас — без перегрузки кожи и лишнего стресса.
        </p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 37. Мотивация
  {
    kind: "info",
    id: "motivation_focus",
    title: "🎯 Давайте сосредоточимся на вашей мотивации",
    subtitle: "Исследования показывают: когда вы держите цель перед глазами, это помогает сохранить мотивацию и добиться долгосрочных результатов",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 38-40. Мотивационные вопросы "Вы узнаёте себя?"
  {
    kind: "info",
    id: "recognize_yourself_1",
    title: "Вы узнаёте себя в этом?",
    visual: "yes_no",
    renderBody: () => (
      <div className="text-center p-4 bg-green-50 rounded-xl">
        <p className="text-sm italic">
          «Я хочу заботиться о своей коже, но не знаю, какие средства выбрать»
        </p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  {
    kind: "info",
    id: "recognize_yourself_2",
    title: "Вы узнаёте себя в этом?",
    visual: "yes_no",
    renderBody: () => (
      <div className="text-center p-4 bg-green-50 rounded-xl">
        <p className="text-sm italic">
          «Я часто бросаю уход, когда он становится слишком сложным или занимает много времени»
        </p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  {
    kind: "info",
    id: "recognize_yourself_3",
    title: "Вы узнаёте себя в этом?",
    visual: "yes_no",
    renderBody: () => (
      <div className="text-center p-4 bg-green-50 rounded-xl">
        <p className="text-sm italic">
          «Я часто чувствую недовольство своей кожей, когда смотрю в зеркало»
        </p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 41. Создан для вас
  {
    kind: "info",
    id: "created_for_you",
    title: "SkinIQ создан для людей, как вы!",
    renderBody: () => (
      <div className="space-y-3 mt-4">
        <div>✨ 97% пользователей отмечают, что SkinIQ помогает лучше заботиться о коже</div>
        <div>🌿 92% заметили улучшения внешнего вида кожи</div>
        <div>⚡️ 85% увидели первые результаты уже в первый месяц</div>
        <p className="text-xs text-neutral-500 mt-4">
          Основано на опросах и отзывах реальных пользователей
        </p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 42. Визуализация изменений
  {
    kind: "info",
    id: "skin_transformation",
    title: "Посмотрите, как меняется ваша кожа!",
    renderBody: () => (
      <div className="text-center mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm">Сейчас</div>
          <div className="flex-1 mx-4 h-2 bg-gradient-to-r from-gray-400 to-green-500 rounded-full"></div>
          <div className="text-sm">Ваша цель</div>
        </div>
        <p className="text-sm text-neutral-600">Здоровье кожи</p>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 43-44. Хотите улучшить/наладить
  {
    kind: "info",
    id: "want_improve",
    title: "Хотите улучшить состояние кожи?",
    visual: "yes_no",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  {
    kind: "info",
    id: "want_establish_routine",
    title: "Хотите наладить свой уход за кожей?",
    visual: "yes_no",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 45. Финальный экран с фото
  {
    kind: "question",
    id: "photo",
    title: "✨ SkinIQ",
    description: "Сделайте селфи, и наш ИИ проанализирует состояние вашей кожи, подберёт персонализированный уход и продукты",
    type: "photo",
    required: false
  }
];

function PhotoStep({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<any | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Формат не поддерживается. Загрузите JPEG/PNG/WebP.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setError("Слишком большой файл. До 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setAnswers({ ...answers, photo_data_url: dataUrl, photo_analysis: null });
      
      setIsAnalyzing(true);
      
      try {
        const analysis = await analyzeSkinPhoto(dataUrl);
        
        if (!analysis) {
          throw new Error('No analysis result received');
        }
        
        const scanEntry = { 
          ts: Date.now(), 
          preview: dataUrl, 
          analysis,
          problemAreas: analysis.problemAreas || []
        };
        
        const updatedAnswers = { 
          ...answers, 
          photo_data_url: dataUrl, 
          photo_analysis: analysis,
          photo_scans: [...(answers.photo_scans || []), scanEntry]
        };
        
        setAnswers(updatedAnswers);
        
      } catch (err) {
        console.error('Photo analysis error:', err);
        setError("Ошибка анализа. Используем демо-результат.");
        
        // Fallback на демо-анализ при ошибке
        const demoAnalysis = {
          skinType: "комбинированная",
          concerns: ["жирность T-зоны", "единичные воспаления"],
          problemAreas: [
            {
              type: "жирность",
              description: "Повышенная жирность в T-зоне",
              severity: "medium",
              coordinates: { x: 35, y: 25, width: 30, height: 15 }
            }
          ],
          recommendations: ["Используйте мягкое очищение", "BHA 2-3 раза в неделю"],
          confidence: 0.75
        };
        
        try {
          const updatedAnswers = { 
            ...answers, 
            photo_data_url: dataUrl, 
            photo_analysis: demoAnalysis,
            photo_scans: [...(answers.photo_scans || []), { 
              ts: Date.now(), 
              preview: dataUrl, 
              analysis: demoAnalysis,
              problemAreas: demoAnalysis.problemAreas || []
            }]
          };
          
          setAnswers(updatedAnswers);
          saveAnswers(updatedAnswers);
        } catch (saveError) {
          console.error('Error saving photo analysis:', saveError);
          setError("Ошибка сохранения. Попробуйте ещё раз.");
        }
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2">📸 Фото-скан (опционально)</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.
        </p>
      </div>
      
      <label className="block w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-gray-400 transition">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <div className="text-2xl mb-2">📷</div>
        <div className="text-sm font-medium text-gray-600">
          {isAnalyzing ? "Анализируем..." : "Нажмите для загрузки фото"}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          JPEG, PNG, WebP до 5 МБ
        </div>
      </label>

      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {answers.photo_data_url && (
        <div className="mt-4">
          <div className="relative inline-block">
            <img 
              src={answers.photo_data_url} 
              alt="Предпросмотр" 
              className="max-h-64 rounded-2xl border" 
            />
            
            {/* Интерактивные проблемные области */}
            {answers.photo_analysis?.problemAreas?.map((area: any, idx: number) => {
              const colors = {
                'акне': 'border-red-600 bg-red-600/50',
                'жирность': 'border-yellow-600 bg-yellow-600/50', 
                'поры': 'border-orange-600 bg-orange-600/50',
                'покраснение': 'border-pink-600 bg-pink-600/50',
                'сухость': 'border-blue-600 bg-blue-600/50'
              };
              
              const colorClass = colors[area.type as keyof typeof colors] || 'border-red-600 bg-red-600/50';
              
              return (
                <div key={idx}>
                  {/* Цветная область */}
                  <div
                    className={`absolute border-4 rounded-lg cursor-pointer hover:opacity-70 transition-all duration-200 ${colorClass}`}
                    style={{
                      left: `${area.coordinates?.x || 0}%`,
                      top: `${area.coordinates?.y || 0}%`,
                      width: `${area.coordinates?.width || 15}%`,
                      height: `${area.coordinates?.height || 15}%`,
                      zIndex: 10,
                      minWidth: '40px',
                      minHeight: '40px'
                    }}
                    onClick={() => setSelectedProblem(selectedProblem?.type === area.type ? null : area)}
                  />
                  
                  {/* Подпись проблемы */}
                  <div
                    className="absolute text-sm font-bold px-3 py-1 rounded-full bg-white border-2 shadow-lg whitespace-nowrap pointer-events-none"
                    style={{
                      left: `${(area.coordinates?.x || 0) + (area.coordinates?.width || 15) + 2}%`,
                      top: `${(area.coordinates?.y || 0) + 5}%`,
                      zIndex: 20,
                      color: area.type === 'жирность' ? '#d97706' : 
                             area.type === 'акне' ? '#dc2626' :
                             area.type === 'поры' ? '#ea580c' : '#6366f1'
                    }}
                  >
                    {area.type}
                  </div>
                </div>
              );
            })}
          </div>
          
          {isAnalyzing && (
            <div className="mt-2 text-sm text-blue-600">
              🔍 Анализируем кожу с помощью ИИ...
            </div>
          )}
          
          {answers.photo_analysis && !isAnalyzing && (
            <div className="mt-4 space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-green-700">✅ Анализ завершён!</h3>
                  <div className="text-sm text-zinc-600">Результаты ИИ-анализа кожи</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div><strong>Тип кожи:</strong> {answers.photo_analysis?.skinType || "не определён"}</div>
                  <div><strong>Проблемы:</strong> {(answers.photo_analysis?.concerns || []).join(", ") || "не обнаружены"}</div>
                  <div><strong>Уверенность:</strong> {Math.round((answers.photo_analysis?.confidence || 0) * 100)}%</div>
                </div>
              </div>
              
              {/* Детали выбранной проблемной области */}
              {selectedProblem && (
                <div className="mt-3 p-3 rounded-xl border-l-4 border-blue-500 bg-blue-50">
                  <div className="text-sm font-medium mb-1">
                    🎯 {selectedProblem.type} ({selectedProblem.severity === 'high' ? 'высокая' : selectedProblem.severity === 'medium' ? 'средняя' : 'низкая'} степень)
                  </div>
                  <div className="text-xs text-zinc-600 mb-2">{selectedProblem.description}</div>
                  
                  <div className="text-xs text-zinc-700">
                    <strong>Что делать:</strong>
                    {selectedProblem.type === 'акне' && " BHA 2-3 раза в неделю, точечные средства"}
                    {selectedProblem.type === 'жирность' && " Лёгкие гели, матирующие средства, ниацинамид"}
                    {selectedProblem.type === 'поры' && " BHA, ретиноиды, ниацинамид для сужения пор"}
                    {selectedProblem.type === 'покраснение' && " Успокаивающие средства, цика, пантенол"}
                    {selectedProblem.type === 'сухость' && " Интенсивное увлажнение, керамиды, гиалуронка"}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-zinc-500 mt-2">
                💡 Кликни на цветные области для детальной информации
              </div>
              
              {answers.photo_analysis.recommendations && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-1">Общие рекомендации:</div>
                  <ul className="text-xs text-zinc-600 list-disc list-inside space-y-1">
                    {answers.photo_analysis.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <button 
            className="mt-3 text-sm text-zinc-600 underline" 
            onClick={() => setAnswers({...answers, photo_data_url: null, photo_analysis: null})}
          >
            Очистить фото
          </button>
        </div>
      )}
    </div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>(loadAnswers);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    saveAnswers(answers);
  }, [answers]);

  useEffect(() => {
    setIsPageLoaded(true);
  }, []);

  const currentStep = screens[currentStepIndex];
  
  // Проверка валидности текущего шага
  const isStepValid = useMemo(() => {
    if (currentStep.kind === "info") return true;
    if (currentStep.kind !== "question") return true;
    if (!currentStep.required) return true;
    
    const answer = answers[currentStep.id as keyof Answers];
    
    if (currentStep.type === "multi") {
      return Array.isArray(answer) && answer.length > 0;
    }
    
    return !!answer;
  }, [currentStep, answers]);
  
  const goNext = () => {
    if (currentStepIndex < screens.length - 1) {
      let nextIndex = currentStepIndex + 1;
      
      // Пропускаем вопрос о беременности для мужчин
      if (screens[nextIndex]?.id === "pregnancy_status" && answers.gender === "Мужской") {
        nextIndex++;
      }
      
      setCurrentStepIndex(nextIndex);
    } else {
      // Показываем экран загрузки на 5 секунд перед планом
      setIsAnalyzing(true);
      setTimeout(() => {
        navigate("/plan");
      }, 5000);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      let prevIndex = currentStepIndex - 1;
      
      // Пропускаем вопрос о беременности для мужчин при возврате
      if (screens[prevIndex]?.id === "pregnancy_status" && answers.gender === "Мужской") {
        prevIndex--;
      }
      
      setCurrentStepIndex(prevIndex);
    }
  };

  return (
    <div className="w-full min-h-screen relative">
      {/* Background */}
      <div 
        className={`fixed inset-0 -z-10 transition-opacity duration-500 ${
          isPageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'linear-gradient(135deg, #f5e6d3 0%, #f5e6d3 30%, #ffffff 50%, #e0f2ff 70%, #bae6fd 85%, #f5e6d3 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradient 10s ease-in-out infinite'
        }}
      />
      

      <div 
        className={`relative z-20 space-y-4 px-2 pb-4 transition-all duration-500 ${
          isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {currentStepIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="text-sm text-neutral-600 flex items-center gap-1 mb-2"
          >
            ← Назад
          </button>
        )}

        <ProgressBar currentStepIndex={currentStepIndex} />

        <div className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6 w-full">
          {currentStep.kind === "question" ? (
            <div>
              <h1 className="text-xl md:text-2xl font-semibold mb-2">
                {currentStep.title}
              </h1>
              {currentStep.description && (
                <p className="opacity-70 mb-4">{currentStep.description}</p>
              )}
              <div className="mb-6">
                {currentStep.type === "single" && (
                  <SingleChoice
                    options={currentStep.options || []}
                    value={answers[currentStep.id as keyof Answers] as string}
                    onChange={v => setAnswers({ ...answers, [currentStep.id]: v })}
                  />
                )}
                {currentStep.type === "multi" && (
                  <MultiChoice
                    options={currentStep.options || []}
                    value={answers[currentStep.id as keyof Answers] as string[]}
                    onChange={v => setAnswers({ ...answers, [currentStep.id]: v })}
                  />
                )}
                {currentStep.type === "photo" && (
                  <PhotoStep answers={answers} setAnswers={setAnswers} />
                )}
              </div>
              <ModernButton 
                onClick={goNext} 
                fullWidth 
                size="lg"
                disabled={!isStepValid}
              >
                {currentStepIndex >= screens.length - 1 ? "Завершить" : "Далее"}
              </ModernButton>
            </div>
          ) : (
            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2">
                {currentStep.title}
              </h2>
              {currentStep.subtitle && (
                <p className="text-sm text-neutral-600 mb-4">{currentStep.subtitle}</p>
              )}
              <div className="mb-6">
                {currentStep.renderBody(answers)}
              </div>
              <ModernButton onClick={goNext} fullWidth size="lg">
                {currentStep.ctaText || "Продолжить"}
              </ModernButton>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      
      {/* Экран загрузки */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #f5e6d3 0%, #f5e6d3 30%, #ffffff 50%, #e0f2ff 70%, #bae6fd 85%, #f5e6d3 100%)',
          animation: 'gradient 10s ease-in-out infinite',
          backgroundSize: '400% 400%'
        }}>
          <div className="text-center px-6">
            <div className="mb-6">
              <div className="relative w-32 h-32 mx-auto">
                {/* Rotating circles */}
                <div className="absolute inset-0 rounded-full border-4 border-neutral-200 opacity-20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-neutral-900 animate-spin"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-3">✨ Анализируем ваши ответы</h2>
            <p className="text-neutral-600 text-lg">Создаём персональный план ухода...</p>
            <div className="mt-6 flex justify-center gap-1">
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
