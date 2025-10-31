import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { analyzeSkinPhoto } from "../lib/skinAnalysis";

// Haptic feedback utility
const vibrate = (pattern: number | number[] = 10) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Custom icon component
const Icon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const icons: Record<string, React.JSX.Element> = {
    'star': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ),
    'check': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polyline points="20,6 9,17 4,12" />
      </svg>
    ),
    'x': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    'search': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    'droplet': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    'microscope': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M6 18h8" />
        <path d="M3 22h18" />
        <path d="M14 22a7 7 0 1 0 0-14h-3" />
        <circle cx="9" cy="9" r="2" />
      </svg>
    ),
    'heart': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      </svg>
    ),
    'sparkles': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
        <path d="M4 17v2" />
        <path d="M5 18H3" />
      </svg>
    ),
    'camera': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
    'target': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    'leaf': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M11 20A7 7 0 0 0 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 7 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </svg>
    ),
    'zap': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
      </svg>
    ),
    'sun': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
    'moon': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    'number-1': (
      <div className={`${className} rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-sm`}>
        1
      </div>
    ),
    'number-2': (
      <div className={`${className} rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-sm`}>
        2
      </div>
    ),
    'number-3': (
      <div className={`${className} rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-sm`}>
        3
      </div>
    ),
    'number-4': (
      <div className={`${className} rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-sm`}>
        4
      </div>
    ),
    'stars': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ),
    'calendar': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    )
  };

  return icons[name] || <div className={className} />;
};

// Error toast component
function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-gray-500/95 to-gray-500/95 backdrop-blur-xl border border-gray-300/60 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <span className="text-white font-medium text-sm flex-1">{message}</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-gray-400/50 flex items-center justify-center hover:bg-gray-400/70 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}



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

// Типы экранов анкеты
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
function QuestionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative bg-white/30 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.1)] min-h-[80px] flex items-center transition-all duration-500 hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] hover:scale-[1.02] overflow-hidden ${className}`}>
      {/* Glassmorphism gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent rounded-2xl"></div>
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}

function SingleChoice({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  const handleKeyDown = (e: React.KeyboardEvent, option: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      vibrate();
      onChange(option);
    }
  };

  const handleClick = (option: string) => {
    vibrate();
    onChange(option);
  };

  return (
    <div className="space-y-2 max-w-none" role="radiogroup" aria-label="Выберите один вариант">
      {options.map((option, index) => {
        const isSelected = value === option;
        const lines = option.split('\n');
        const optionId = `option-${index}`;
        
        return (
          <QuestionCard key={option} className="cursor-pointer transition-all duration-500 hover:bg-white/25 hover:scale-[1.01]">
          <button
            type="button"
              onClick={() => handleClick(option)}
              onKeyDown={(e) => handleKeyDown(e, option)}
              className="w-full flex items-start gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c7ff] focus-visible:ring-offset-0 rounded-2xl transition-colors duration-200"
              role="radio"
              aria-checked={isSelected}
              aria-describedby={`${optionId}-description`}
              id={optionId}
              tabIndex={isSelected ? 0 : -1}
            >
              {/* Текст опции */}
              <div className="flex-1 min-w-0">
            {lines.map((line, idx) => (
                  <div 
                    key={idx} 
                    id={idx === 1 ? `${optionId}-description` : undefined}
                    className={`font-normal text-gray-800 ${idx === 0 ? 'text-base mb-1 leading-tight' : 'text-sm text-gray-600 mt-1 leading-relaxed'}`}
                  >
                {line}
              </div>
            ))}
              </div>
              
              {/* Glassmorphism radio button */}
              <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isSelected 
                  ? 'border-gray-400 bg-gray-500 shadow-[0_4px_16px_rgba(0,0,0,0.1)]' 
                  : 'border-gray-300 bg-gray-100'
              }`}>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm"></div>
                )}
              </div>
          </button>
          </QuestionCard>
        );
      })}
    </div>
  );
}

function MultiChoice({ options, value, onChange }: { options: string[]; value?: string[]; onChange: (v: string[]) => void }) {
  const selected = new Set(value || []);
  
  const toggleOption = (option: string) => {
                const newSelected = new Set(selected);
    if (selected.has(option)) {
                  newSelected.delete(option);
                } else {
                  newSelected.add(option);
                }
                onChange(Array.from(newSelected));
  };

  const handleKeyDown = (e: React.KeyboardEvent, option: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      vibrate();
      toggleOption(option);
    }
  };

  const handleClick = (option: string) => {
    vibrate();
    toggleOption(option);
  };
  
  return (
    <div className="space-y-2 max-w-none" role="group" aria-label="Выберите несколько вариантов">
      {options.map((option, index) => {
        const isSelected = selected.has(option);
        const optionId = `multi-option-${index}`;
        
        return (
          <QuestionCard key={option} className="cursor-pointer transition-all duration-500 hover:bg-white/25 hover:scale-[1.01]">
            <button
              type="button"
              onClick={() => handleClick(option)}
              onKeyDown={(e) => handleKeyDown(e, option)}
              className="w-full flex items-center gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c7ff] focus-visible:ring-offset-0 rounded-2xl transition-colors duration-200"
              role="checkbox"
              aria-checked={isSelected}
              id={optionId}
            >
              <div className={`w-6 h-6 rounded-xl border flex items-center justify-center transition-all duration-120 ${
                  isSelected 
                  ? 'border-transparent bg-gray-500 text-white scale-100' 
                  : 'border-gray-300 bg-gray-100 text-gray-400 scale-95'
              }`}>
                {isSelected && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                )}
            </div>
              <span className="flex-1 text-base font-normal text-gray-800 leading-relaxed">{option}</span>
            </button>
          </QuestionCard>
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
  const progressWidth = percentage === 0 ? 0 : Math.max(8, percentage);

  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="relative w-full h-7 sm:h-8">
        <div className="absolute inset-0 rounded-full bg-white/12 border border-white/35 backdrop-blur-[18px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/8 to-transparent opacity-70 pointer-events-none"></div>
      </div>
        <div className="absolute inset-[3px] rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-[width] duration-700 ease-out relative"
            style={{ 
              width: `${progressWidth}%`,
              background: 'linear-gradient(120deg, rgba(213,188,255,0.95) 0%, rgba(227,210,255,0.9) 45%, rgba(242,226,255,0.85) 100%)',
              boxShadow: progressWidth > 0 ? '0 0 35px rgba(213, 188, 255, 0.55)' : undefined
            }}
          aria-label="Прогресс анкеты"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/8 to-transparent opacity-30 blur-[1.5px] animate-shimmer" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#EDE6FF]/45 blur-[36px] rounded-full pointer-events-none" />
          </div>
        </div>
        <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
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
    title: "",
    subtitle: "",
    renderBody: () => (
      <div className="flex flex-col items-center text-center gap-8">
        <div className="relative w-full h-48 sm:h-56 rounded-[30px] border border-white/60 bg-white/25 backdrop-blur-2xl shadow-[0_20px_50px_rgба(0,0,0,0.1)] overflow-hidden">
          <img
            src="/quiz_welocme_image.png"
            alt="SkinIQ — подбор ухода"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
        </div>
        <div className="space-y-4 px-2">
          <h1 className="text-[22px] sm:text-[24px] font-normal leading-tight text-gray-900">
            Подбери эффективный уход для своей кожи со <span className="font-semibold text-[22px] sm:text-[24px]">SkinIQ</span>
          </h1>
            </div>
              </div>
    ),
    ctaText: "Продолжить"
  },
  {
    kind: "info",
    id: "how_it_works",
    title: "Как это работает",
    subtitle: "Всего четыре шага до персонального плана",
    renderBody: () => (
      <div className="space-y-6">
        <div className="grid gap-3">
          {[
            {
              icon: "search",
              text: "Ответьте на несколько вопросов",
            },
            {
              icon: "camera",
              text: "Загрузите фото",
            },
            {
              icon: "sparkles",
              text: "Получите персональную подборку ухода",
            },
            {
              icon: "calendar",
              text: "Увидьте, как будет меняться кожа 12 недель",
            },
          ].map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-3xl bg-white/25 backdrop-blur-2xl border border-white/40 px-4 py-3 shadow-[0_12px_30px_rgaba(0,0,0,0.1)]"
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_10px_28px_rgaba(0,0,0,0.12)] flex-shrink-0">
                <Icon name={step.icon} className="w-5 h-5 text-gray-800" />
              </div>
              <span className="text-sm sm:text-base text-gray-800 font-medium text-left">
                {step.text}
              </span>
              </div>
          ))}
            </div>
          </div>
    ),
    ctaText: "Продолжить"
  },

  // 2. Персональный анализ кожи
  {
    kind: "info",
    id: "personal_analysis",
    title: "Персональный анализ кожи",
    renderBody: () => (
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/40 bg-white/25 backdrop-blur-2xl shadow-[0_14px_40px_rgba(0,0,0,0.12)] p-5 space-y-4">
          {[
            { icon: "search", text: "Детальный разбор — морщины, линии и текстура в 3D" },
            { icon: "droplet", text: "Уровень увлажнённости — персональная оценка баланса влаги" },
            { icon: "microscope", text: "Поры — точное выявление и измерение" },
            { icon: "heart", text: "Здоровье кожи — покраснения, воспаления, раздражения" },
          ].map((feature, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_8px_18px_rgaba(0,0,0,0.08)] flex-shrink-0">
                <Icon name={feature.icon} className="w-5 h-5 text-gray-700" />
              </div>
              <span className="text-sm text-gray-800 font-medium leading-relaxed text-left">
                {feature.text}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 text-xs text-left">
          <div className="flex items-center gap-2 text-gray-700">
            <div className="w-4 h-4 flex items-center justify-center text-[#7C3AED]">
              <Icon name="check" className="w-4 h-4" />
            </div>
            <span>89% пользователей отмечают улучшение состояния кожи за 1 месяц</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <div className="w-4 h-4 flex items-center justify-center text-[#7C3AED]">
              <Icon name="check" className="w-4 h-4" />
            </div>
            <span>Наш подход в 3 раза эффективнее обычных рутин</span>
          </div>
        </div>
      </div>
    ),
    ctaText: "Продолжить"
  },

  // 3. Цели для кожи
  {
    kind: "info",
    id: "goals_intro",
    title: "Какую цель вы ставите перед собой?",
    subtitle: "Помогите нам понять, к чему вы стремитесь в уходе за кожей",
    renderBody: () => null,
    ctaText: "Продолжить"
  },

  // 4. Вопрос о целях
  {
    kind: "question",
    id: "skin_goals",
    title: "Выберите ваши главные цели",
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
    title: "Тысячи людей уже добились здоровой и красивой кожи с нами",
    subtitle: "Персональный уход, который решает именно вашу задачу",
    visual: "testimonials",
    renderBody: () => (
      <div className="space-y-4 mt-4 overflow-x-auto px-6 sm:px-8 py-2">
        <div className="flex gap-4 pb-6 pr-4">
          {[
            { name: "Ольга, Санкт-Петербург", text: "С помощью подобранного ухода я убрала акне и следы постакне за 3 месяца. Удобно, что можно просто загрузить фото!", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=80" },
            { name: "Дарья, Казань", text: "Моя кожа стала более упругой и увлажнённой. Приложение помогло подобрать уход, который реально работает!", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&q=80" },
            { name: "Ирина, Новосибирск", text: "У меня была проблема с покраснением и чувствительностью, через месяц стало намного лучше, кожа спокойнее!", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&q=80" },
            { name: "Екатерина, Москва", text: "Всегда мучалась с расширенными порами и жирным блеском. Теперь макияж хорошо держится, жирный блеск появляется только к концу дня", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80" }
          ].map((review, i) => (
            <div key={i} className="min-w-[320px] p-5 bg-gradient-to-br from-white/95 via-white/80 to-[#f4f0ff] backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-3 mb-3">
                <img src={review.image} alt={review.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map((n) => (
                      <Icon key={n} name="star" className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs font-medium text-gray-800">{review.name}</p>
                </div>
              </div>
              <p className="text-sm mb-2 text-gray-900">«{review.text}»</p>
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
    title: "Сколько вам лет?",
    type: "single",
    options: ["До 18 лет", "18–24", "25–34", "35–44", "45+"],
    required: true
  },
  
  // 8. Вопрос о поле
  {
    kind: "question",
    id: "gender", 
    title: "Ваш пол",
    type: "single",
    options: ["Женский", "Мужской"],
    required: true
  },
  
  // 9. Узнаем особенности кожи
  {
    kind: "info",
    id: "skin_features_intro",
    title: "Расскажите о вашей коже",
    subtitle: "Это поможет нам подобрать идеальный уход именно для вас",
    renderBody: () => null,
    ctaText: "Продолжить"
  },
  
  // 10. Вопрос о типе кожи
  {
    kind: "question",
    id: "skin_type",
    title: "Какой у вас тип кожи?",
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
    title: "Какие проблемы кожи вас беспокоят?",
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
    title: "Уход за кожей простым и понятным",
    visual: "comparison",
    renderBody: () => (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <div className="font-semibold mb-2">Традиционный уход</div>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="x" className="w-4 h-4 text-gray-500" />
              <span>Часы поиска советов в интернете</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="x" className="w-4 h-4 text-gray-500" />
              <span>Тратить деньги на неподходящие средства</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="x" className="w-4 h-4 text-gray-500" />
              <span>Результата приходится ждать месяцами</span>
            </div>
          </div>
        </div>
        <div>
          <div className="font-semibold mb-2">С нашим подходом</div>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="check" className="w-4 h-4 text-gray-500" />
              <span>Персональные рекомендации для вашего типа кожи</span>
          </div>
            <div className="flex items-center gap-2">
              <Icon name="check" className="w-4 h-4 text-gray-500" />
              <span>Сканируйте и отслеживайте прогресс легко</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="check" className="w-4 h-4 text-gray-500" />
              <span>Видимые результаты уже через несколько недель</span>
            </div>
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
    title: "💙 Забота о вашем здоровье",
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
    title: "ИИ для подбора ухода, который действительно работает",
    visual: "product_showcase",
    renderBody: () => (
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 mt-2 rounded-2xl border-2 border-dashed border-gray-300/50 bg-gray-50/20 flex items-center justify-center">
              <div className="text-2xl">💧</div>
            </div>
            <div className="text-xs font-medium text-white">Увлажняющий крем</div>
            <div className="text-xs text-gray-600">Поддерживает барьер кожи</div>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 mt-2 rounded-2xl border-2 border-dashed border-gray-300/50 bg-gray-50/20 flex items-center justify-center">
              <div className="text-2xl">✨</div>
            </div>
            <div className="text-xs font-medium text-white">Сыворотка с витамином C</div>
            <div className="text-xs text-gray-600">Осветляет и выравнивает тон</div>
          </div>
          <div className="text-center flex flex-col justify-center h-full">
            <div className="w-16 h-16 mx-auto mb-3 mt-2 rounded-2xl border-2 border-dashed border-gray-300/50 bg-gray-50/20 flex items-center justify-center">
              <div className="text-lg font-bold text-white">50</div>
            </div>
            <div className="text-xs font-medium text-white">Солнцезащитный крем SPF</div>
            <div className="text-xs text-gray-600">Защищает от фотостарения</div>
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
      "Курю",
      "Употребляю алкоголь",
      "Часто не высыпаюсь",
      "Испытываю стресс",
      "Ем много сладкого",
      "Ем много фастфуда",
      "Часто бываю на солнце без SPF",
      "Нет, у меня нет таких привычек"
    ],
    required: false
  },

  // 31. AI подбор (сравнение)
  {
    kind: "info",
    id: "ai_comparison",
    title: "Больше никакой путаницы — AI подберёт уход быстро и точно",
    visual: "comparison",
    renderBody: () => (
      <div className="space-y-4 mt-4">
        <div className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl border border-white/40 p-2">
          <div className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300/50 bg-gray-50/20 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">📱</div>
              <div className="text-sm text-purple-200">Фото девушки с приложением</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
        <div className="text-left">
          <div className="font-semibold mb-2 text-white">Традиционный подбор ухода</div>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="x" className="w-4 h-4 text-red-400" />
                <span className="text-gray-600">Долгие поиски советов в интернете</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="x" className="w-4 h-4 text-red-400" />
                <span className="text-gray-600">Сложно понять, что подойдёт именно вам</span>
              </div>
          </div>
        </div>
        <div className="text-left">
            <div className="font-semibold mb-2 text-white">Наш AI-анализ</div>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="check" className="w-4 h-4 text-green-400" />
                <span className="text-gray-600">Фотоанализ и точный подбор средств</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="check" className="w-4 h-4 text-green-400" />
                <span className="text-gray-600">Рекомендации за пару секунд</span>
              </div>
            </div>
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
    title: "Расскажите о ваших предпочтениях в уходе",
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
    title: "Не нужно бояться ошибок — уход должен быть комфортным!",
    renderBody: () => (
      <div className="space-y-4 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gray-50/40 backdrop-blur-xl border border-gray-200/50">
          <img 
            src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=250&fit=crop&q=80" 
            alt="Девушка с красивой кожей" 
            className="w-full h-40 object-cover"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Icon name="x" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Слишком много средств сразу</span>
        </div>
          <div className="flex items-center gap-2">
            <Icon name="check" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Последовательный уход шаг за шагом</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="x" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Ожидать моментальный результат</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="check" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Смотреть на долгосрочные изменения</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="x" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Копировать чужой уход</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="check" className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Подбор под особенности вашей кожи</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 text-center mt-4">
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
    title: "Давайте сосредоточимся на вашей мотивации",
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
      <div className="text-center p-4 bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <p className="text-sm italic text-neutral-800">
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
      <div className="text-center p-4 bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <p className="text-sm italic text-neutral-800">
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
      <div className="text-center p-4 bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <p className="text-sm italic text-neutral-800">
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
    title: "Создан для людей, как вы!",
    renderBody: () => (
      <div className="space-y-4 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gray-50/40 backdrop-blur-xl border border-gray-200/50">
          <img 
            src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop&q=80" 
            alt="Девушка с красивой кожей" 
            className="w-full h-48 object-cover"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Icon name="sparkles" className="w-5 h-5 text-gray-500" />
            <span>97% пользователей отмечают, что наш подход помогает лучше заботиться о коже</span>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="leaf" className="w-5 h-5 text-gray-500" />
            <span>92% заметили улучшения внешнего вида кожи</span>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="zap" className="w-5 h-5 text-gray-500" />
            <span>85% увидели первые результаты уже в первый месяц</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-4 text-center">
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
    title: "Фото-анализ кожи",
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
        <h3 className="text-lg font-bold mb-2 flex items-center justify-center gap-2">
          <Icon name="camera" className="w-6 h-6 text-gray-500" />
          Фото-скан (опционально)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.
        </p>
      </div>
      
      <label className="block w-full p-4 border-2 border-dashed border-white/50 rounded-xl text-center cursor-pointer hover:border-white/70 transition-all duration-200 bg-white/20 backdrop-blur-xl hover:bg-white/30 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
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
        <div className="text-sm font-medium text-neutral-700">
          {isAnalyzing ? "Анализируем..." : "Нажмите для загрузки фото"}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          JPEG, PNG, WebP до 5 МБ
        </div>
      </label>

      {error && (
        <div role="alert" className="mt-3 text-sm text-gray-700 bg-white/40 backdrop-blur-xl border border-gray-200 rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
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
                'покраснение': 'border-gray-600 bg-gray-600/50',
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
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2 justify-center">
              <Icon name="search" className="w-4 h-4" />
              Анализируем кожу с помощью ИИ...
            </div>
          )}
          
          {answers.photo_analysis && !isAnalyzing && (
            <div className="mt-4 space-y-3">
              <div className="bg-white/40 backdrop-blur-xl border border-green-200 rounded-xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-green-700 flex items-center justify-center gap-2">
                    <Icon name="check" className="w-5 h-5" />
                    Анализ завершён!
                  </h3>
                  <div className="text-sm text-neutral-600">Результаты ИИ-анализа кожи</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div><strong>Тип кожи:</strong> {answers.photo_analysis?.skinType || "не определён"}</div>
                  <div><strong>Проблемы:</strong> {(answers.photo_analysis?.concerns || []).join(", ") || "не обнаружены"}</div>
                  <div><strong>Уверенность:</strong> {Math.round((answers.photo_analysis?.confidence || 0) * 100)}%</div>
                </div>
              </div>
              
              {/* Детали выбранной проблемной области */}
              {selectedProblem && (
                <div className="mt-3 p-3 rounded-xl border-l-4 border-blue-500 bg-white/40 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                  <div className="text-sm font-medium mb-1 flex items-center gap-2">
                    <Icon name="target" className="w-4 h-4 text-gray-500" />
                    {selectedProblem.type} ({selectedProblem.severity === 'high' ? 'высокая' : selectedProblem.severity === 'medium' ? 'средняя' : 'низкая'} степень)
                  </div>
                  <div className="text-xs text-neutral-600 mb-2">{selectedProblem.description}</div>
                  
                  <div className="text-xs text-neutral-700">
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
            className="mt-3 text-sm text-neutral-600 underline hover:text-neutral-800 transition-colors" 
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
  const [error, setError] = useState<string | null>(null);



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
      <div 
      className="w-full min-h-screen relative overflow-x-hidden safe-area-inset"
          style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Background in style of main page */}
      <div className="fixed inset-0 -z-10 quiz-gradient-animation" />

      {/* Header */}
      {currentStepIndex > 0 && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Назад"
          className="absolute z-50 flex items-center justify-center text-gray-700 hover:text-gray-900 transition"
          style={{
            left: `calc(env(safe-area-inset-left, 0px) + 34px)`,
            top: `calc(env(safe-area-inset-top, 0px) + 50px)`
          }}
        >
          <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-6">
            <path d="M26 12H6" />
            <path d="M12 5l-6 7 6 7" />
          </svg>
        </button>
      )}
      <div className="absolute left-1/2 transform -translate-x-1/2 z-40" style={{ top: `calc(env(safe-area-inset-top, 0px) - 30px)` }}>
        <Link to="/" className="block cursor-pointer hover:opacity-80 transition-opacity">
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            className="h-36 w-auto object-contain"
          />
        </Link>
      </div>

      <div 
        className={`relative z-20 px-2 pb-4 pt-24 transition-all duration-500 max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl sm:px-6 h-screen flex flex-col ${
          isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {currentStep.kind === "question" && <ProgressBar currentStepIndex={currentStepIndex} />}

        <div className="relative w-full max-w-2xl mx-auto">
          {/* Main glassmorphism container */}
          <div className="bg-white/15 backdrop-blur-3xl border border-white/30 shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-[2rem] p-8 transform transition-all duration-700 hover:shadow-[0_25px_80px_rgba(0,0,0,0.15)] hover:scale-[1.01] relative overflow-hidden">
            {/* Glassmorphism layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-white/10 to-transparent rounded-[2rem]"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-gray-500/5 via-transparent to-gray-500/5 rounded-[2rem]"></div>
            
            {/* Content */}
            <div className="relative z-10">
        {currentStep.kind === "question" ? (
            <div>
            <h1 className="text-[18px] font-semibold text-gray-900 mb-4 text-center leading-tight">
                {currentStep.title}
              </h1>
            {currentStep.description && (
              <p className="text-[14px] text-gray-600 mb-6 text-center leading-relaxed">{currentStep.description}</p>
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
              <button
                onClick={goNext}
                disabled={!isStepValid}
                className={`group relative w-full h-14 rounded-2xl font-bold text-base transition-all duration-500 touch-manipulation overflow-hidden ${
                  isStepValid
                    ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gradient-to-r from-gray-400 to-gray-500 text-white/90 opacity-80 cursor-not-allowed"
                }`}
              >
                {/* Glassmorphism shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className={`relative z-10 flex items-center justify-center gap-2 font-semibold ${isStepValid ? 'text-white' : 'text-white/90'}`}>
                  {currentStepIndex >= screens.length - 1 ? "✨ Завершить" : "Продолжить →"}
                </span>
              </button>
            </div>
          ) : (
            <div>
            <h2 className="text-[18px] font-semibold text-gray-900 mb-2">
              {currentStep.title}
            </h2>
            {currentStep.subtitle && (
              <p className="text-sm text-neutral-600 mb-4">{currentStep.subtitle}</p>
            )}
            <div className="mb-6">
              {currentStep.renderBody(answers)}
            </div>
              <button
                onClick={goNext}
                className="w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 shadow-[0_10px_30px_rgба(0,0,0,0.2)] hover:shadow-[0_15px_40px_rgба(0,0,0,0.3)] transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 touch-manipulation"
              >
                <span className="font-semibold">
                  {currentStep.ctaText || "Продолжить →"}
                </span>
              </button>
            </div>
        )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Экран загрузки */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Background with same image as main page */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/bg/IMG_8368 (2).PNG')"
            }}
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-xl" />
          
          <div className="relative z-10 text-center px-6">
            <div className="bg-white/40 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-8">
            <div className="mb-6">
              <div className="relative w-32 h-32 mx-auto">
                {/* Rotating circles */}
                  <div className="absolute inset-0 rounded-full border-4 border-white/30 opacity-20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-neutral-900 animate-spin"></div>
              </div>
            </div>
            <h2 className="text-[18px] font-semibold text-gray-900 mb-3">✨ Анализируем ваши ответы</h2>
              <p className="text-neutral-700 text-lg">Создаём персональный план ухода...</p>
            <div className="mt-6 flex justify-center gap-1">
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-neutral-900 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Toast */}
      {error && (
        <ErrorToast 
          message={error} 
          onClose={() => setError(null)} 
        />
      )}
      
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        .animate-shimmer {
          animation: shimmer 3.8s ease-in-out infinite;
        }
        .quiz-gradient-animation {
          background: linear-gradient(130deg, #d9dbe6 0%, #e9ebf2 40%, #ffffff 70%, #e2e5ed 100%);
          background-size: 300% 300%;
          animation: quizGradientMotion 18s ease-in-out infinite;
        }
        @keyframes quizGradientMotion {
          0% { background-position: 0% 0%; }
          25% { background-position: 50% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 50% 50%; }
          100% { background-position: 0% 0%; }
        }
      `}</style>
    </div>
  );
}
