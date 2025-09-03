import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "skiniq.answers";

interface Answers {
  name?: string;
  pdConsent?: boolean;
  skinType?: "сухая" | "жирная" | "комбинированная" | "нормальная";
  sensitivity?: boolean;
  concerns?: string[];
  oiliness?: "низкая" | "средняя" | "высокая";
  primaryGoal?: "снять воспаления" | "увлажнить" | "осветлить постакне" | "сузить поры";
  
  // Фото (опционально)
  photo_data_url?: string | null;
  photo_analysis?: string | null;
  photo_scans?: { ts: number; preview: string; analysis: string }[];
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

const questions = [
  {
    kind: "question" as const,
    id: "name",
    title: "Как вас зовут?",
    description: "Чтобы мы могли обращаться по имени.",
    type: "text" as const,
    required: true,
    needsConsent: true
  },
  {
    kind: "question" as const,
    id: "skinType",
    title: "Какой у вас тип кожи?",
    type: "single" as const,
    required: true,
    options: ["сухая", "жирная", "комбинированная", "нормальная"]
  },
  {
    kind: "question" as const,
    id: "sensitivity",
    title: "Ваша кожа чувствительная?",
    type: "switch" as const,
    required: true
  },
  {
    kind: "question" as const,
    id: "concerns",
    title: "Что вас беспокоит?",
    description: "Можно выбрать несколько вариантов.",
    type: "multi" as const,
    required: true,
    options: ["акне", "постакне", "расширенные поры", "покраснение", "сухость"]
  },
  {
    kind: "question" as const,
    id: "oiliness",
    title: "Насколько кожа склонна к жирности?",
    type: "single" as const,
    required: true,
    options: ["низкая", "средняя", "высокая"]
  },
  {
    kind: "question" as const,
    id: "primaryGoal",
    title: "Главная цель ухода на 28 дней?",
    type: "single" as const,
    required: true,
    options: ["снять воспаления", "увлажнить", "осветлить постакне", "сузить поры"]
  }
];

const insights = questions.map(q => ({
  kind: "insight" as const,
  id: `insight_${q.id}`,
  forQuestionId: q.id,
  title: "Небольшой инсайт",
  renderBody: (answers: Answers) => {
    switch (q.id) {
      case "skinType":
        return (
          <p className="opacity-80">
            Для типа кожи <b>{answers.skinType ?? "—"}</b> мы осторожнее подбираем очищение и активы: избегаем пересушивания и соблюдаем баланс pH.
          </p>
        );
      case "sensitivity":
        return answers.sensitivity ? (
          <p className="opacity-80">
            Чувствительная кожа любит мягкое очищение, SPF без отдушек и постепенный ввод активов.
          </p>
        ) : (
          <p className="opacity-80">
            Отлично: при отсутствии высокой чувствительности можно смелее использовать кислоты и ретиноиды (по схеме).
          </p>
        );
      case "concerns":
        return (
          <p className="opacity-80">
            По вашим жалобам ({(answers.concerns || []).join(", ") || "—"}) мы настроим приоритеты: сначала — снятие воспалений/раздражений, затем работа с текстурой и тонизацией.
          </p>
        );
      case "oiliness":
        return (
          <p className="opacity-80">
            Уровень жирности: <b>{answers.oiliness ?? "—"}</b>. Это влияет на выбор форматов: гели/флюиды днём, более плотное увлажнение — вечером.
          </p>
        );
      case "primaryGoal":
        return (
          <p className="opacity-80">
            Главная цель — <b>{answers.primaryGoal ?? "—"}</b>. План и активы будут выстроены вокруг этой цели на ближайшие 28 дней.
          </p>
        );
      default:
        return null;
    }
  }
}));

function createSteps() {
  const steps: any[] = [];
  questions.forEach((question, index) => {
    steps.push(question);
    if (index > 0) {
      steps.push(insights[index]);
    }
  });
  
  // Добавляем финальный опциональный шаг фото
  steps.push({
    kind: "question" as const,
    id: "photo",
    title: "Фото-скан (опционально)",
    description: "Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.",
    type: "photo" as const,
    required: false
  });
  
  return steps;
}

const allSteps = createSteps();
const totalQuestions = questions.length;

function PhotoStep({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const [error, setError] = useState<string | null>(null);

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
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const analysis = "Обнаружены признаки лёгкой жирности T-зоны, единичные воспаления.";
      setAnswers({ 
        ...answers, 
        photo_data_url: dataUrl, 
        photo_analysis: analysis,
        photo_scans: [...(answers.photo_scans || []), { ts: Date.now(), preview: dataUrl, analysis }]
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 mb-5">
      <h3 className="text-lg font-bold mb-2">Фото-скан (опционально)</h3>
      <p className="text-sm text-neutral-600 mb-3">
        Можно добавить фото без макияжа при дневном свете — я учту это при планировании. Можно пропустить.
      </p>
      
      <label className="inline-flex items-center px-4 py-2 rounded-full border bg-white/70 cursor-pointer">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        Загрузить фото
      </label>

      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {answers.photo_data_url && (
        <div className="mt-4">
          <img src={answers.photo_data_url} alt="Предпросмотр" className="max-h-64 rounded-2xl border" />
          {answers.photo_analysis && (
            <div className="mt-2 text-sm text-zinc-700">{answers.photo_analysis}</div>
          )}
          <button 
            className="mt-3 text-sm text-zinc-600 underline" 
            onClick={() => setAnswers({...answers, photo_data_url: null, photo_analysis: null})}
          >
            Очистить фото
          </button>
        </div>
      )}

      {(answers.photo_scans?.length || 0) > 0 && (
        <div className="mt-5">
          <div className="font-semibold mb-2">История сканов</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {answers.photo_scans!.slice().reverse().map((s, idx) => (
              <div key={idx} className="p-2 rounded-xl border bg-white/60">
                <img src={s.preview} alt="Скан" className="h-28 w-full object-cover rounded-lg" />
                <div className="mt-1 text-xs text-zinc-600">{new Date(s.ts).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ currentStepIndex }: { currentStepIndex: number }) {
  const completedQuestions = useMemo(() => 
    allSteps.slice(0, currentStepIndex + 1).filter(step => step.kind === "question").length,
    [currentStepIndex]
  );
  
  const percentage = Math.round((completedQuestions / totalQuestions) * 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>Шаг {completedQuestions} из {totalQuestions}</span>
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

function SingleChoice({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(option => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-4 py-3 rounded-xl border transition text-left ${
              isSelected ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice({ options, value, onChange }: { options: string[]; value?: string[]; onChange: (v: string[]) => void }) {
  const selected = new Set(value || []);
  
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isSelected = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              const newSelected = new Set(selected);
              if (isSelected) {
                newSelected.delete(option);
              } else {
                newSelected.add(option);
              }
              onChange(Array.from(newSelected));
            }}
            className={`px-3 py-2 rounded-full border text-sm transition ${
              isSelected ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SwitchInput({ checked, onChange, labelYes = "Да", labelNo = "Нет" }: { checked?: boolean; onChange: (v: boolean) => void; labelYes?: string; labelNo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${checked ? "opacity-60" : "font-semibold"}`}>
        {labelNo}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${
          checked ? "bg-black" : "bg-neutral-300"
        }`}
      >
        <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
      <span className={`text-sm ${checked ? "font-semibold" : "opacity-60"}`}>
        {labelYes}
      </span>
    </div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>(loadAnswers);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    saveAnswers(answers);
  }, [answers]);

  const currentStep = allSteps[currentStepIndex];
  
  const isStepValid = useMemo(() => {
    if (currentStep.kind !== "question") return true;
    
    switch (currentStep.id) {
      case "name":
        return currentStep.needsConsent && !answers.pdConsent ? false : !!(answers.name && answers.name.trim().length > 0);
      case "skinType":
        return !!answers.skinType;
      case "sensitivity":
        return typeof answers.sensitivity === "boolean";
      case "concerns":
        return Array.isArray(answers.concerns) && answers.concerns.length > 0;
      case "oiliness":
        return !!answers.oiliness;
      case "primaryGoal":
        return !!answers.primaryGoal;
      case "photo":
        return true; // Опциональный шаг
      default:
        return false;
    }
  }, [currentStep, answers]);

  const goNext = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      navigate("/plan");
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const renderQuestionInput = (step: any) => {
    switch (step.id) {
      case "name":
        return (
          <>
            <input
              autoFocus
              type="text"
              placeholder="Введите имя"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-black"
              value={answers.name ?? ""}
              onChange={e => setAnswers({ ...answers, name: e.target.value })}
            />
            <label className="flex items-start gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={!!answers.pdConsent}
                onChange={e => setAnswers({ ...answers, pdConsent: e.target.checked })}
              />
              <span>Я согласен(-на) на обработку персональных данных.</span>
            </label>
          </>
        );
      case "skinType":
        return (
          <SingleChoice
            options={step.options}
            value={answers.skinType}
            onChange={v => setAnswers({ ...answers, skinType: v as any })}
          />
        );
      case "sensitivity":
        return (
          <SwitchInput
            checked={!!answers.sensitivity}
            onChange={v => setAnswers({ ...answers, sensitivity: v })}
            labelNo="Нет"
            labelYes="Да"
          />
        );
      case "concerns":
        return (
          <MultiChoice
            options={step.options}
            value={answers.concerns}
            onChange={v => setAnswers({ ...answers, concerns: v })}
          />
        );
      case "oiliness":
        return (
          <SingleChoice
            options={step.options}
            value={answers.oiliness}
            onChange={v => setAnswers({ ...answers, oiliness: v as any })}
          />
        );
      case "primaryGoal":
        return (
          <SingleChoice
            options={step.options}
            value={answers.primaryGoal}
            onChange={v => setAnswers({ ...answers, primaryGoal: v as any })}
          />
        );
      case "photo":
        return <PhotoStep answers={answers} setAnswers={setAnswers} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <button
        type="button"
        onClick={goBack}
        className="mb-4 text-sm underline opacity-70 hover:opacity-100 disabled:opacity-40"
        disabled={currentStepIndex === 0}
        aria-label="Назад"
      >
        ← Назад
      </button>

      <ProgressBar currentStepIndex={currentStepIndex} />

      <section className="rounded-2xl p-5 border border-neutral-200">
        {currentStep.kind === "question" ? (
          <>
            <h1 className="text-xl md:text-2xl font-semibold mb-2">
              {currentStep.title}
            </h1>
            {currentStep.description && (
              <p className="opacity-70 mb-4">{currentStep.description}</p>
            )}
            <div className="mb-6">
              {renderQuestionInput(currentStep)}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={goNext}
                disabled={!isStepValid}
                className={`rounded-xl px-4 py-2 border transition ${
                  isStepValid 
                    ? "border-black hover:bg-black hover:text-white" 
                    : "border-neutral-300 opacity-60 cursor-not-allowed"
                }`}
                aria-label="Далее"
              >
                Далее
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl md:text-2xl font-semibold mb-2">
              {currentStep.title}
            </h2>
            <div className="mb-6">
              {currentStep.renderBody(answers)}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl px-4 py-2 border border-black hover:bg-black hover:text-white transition"
            >
              Продолжить
            </button>
          </>
        )}
      </section>
    </div>
  );
}