// pages/Quiz.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type QuestionType = "text" | "single" | "multi" | "switch";
type StepKind = "question" | "insight";

type Answers = {
  // Q1
  name?: string;
  pdConsent?: boolean;
  // Q2
  skinType?: "сухая" | "жирная" | "комбинированная" | "нормальная";
  // Q3
  sensitivity?: boolean; // true = чувствительная
  // Q4
  concerns?: string[]; // множественный выбор
  // Q5
  oiliness?: "низкая" | "средняя" | "высокая";
  // Q6
  primaryGoal?: "снять воспаления" | "увлажнить" | "осветлить постакне" | "сузить поры";
};

type QuestionStep = {
  kind: "question";
  id:
    | "name"
    | "skinType"
    | "sensitivity"
    | "concerns"
    | "oiliness"
    | "primaryGoal";
  title: string;
  description?: string;
  type: QuestionType;
  required?: boolean;
  options?: string[]; // для single/multi
  // для Q1 — требование согласия на ПД
  needsConsent?: boolean;
};

type InsightStep = {
  kind: "insight";
  id: string;
  forQuestionId: QuestionStep["id"];
  title: string;
  renderBody: (a: Answers) => React.ReactNode;
};

type Step = QuestionStep | InsightStep;

// ---------- LocalStorage helpers ----------
const LS_KEY = "skiniq.answers";

function loadAnswersLS(): Answers {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Answers;
  } catch {
    return {};
  }
}

function saveAnswersLS(patch: Partial<Answers> | ((prev: Answers) => Answers)) {
  const prev = loadAnswersLS();
  const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}

// ---------- Steps definition ----------
const questionSteps: QuestionStep[] = [
  {
    kind: "question",
    id: "name",
    title: "Как вас зовут?",
    description: "Чтобы мы могли обращаться по имени.",
    type: "text",
    required: true,
    needsConsent: true, // чекбокс согласия на ПД
  },
  {
    kind: "question",
    id: "skinType",
    title: "Какой у вас тип кожи?",
    type: "single",
    required: true,
    options: ["сухая", "жирная", "комбинированная", "нормальная"],
  },
  {
    kind: "question",
    id: "sensitivity",
    title: "Ваша кожа чувствительная?",
    type: "switch",
    required: true,
  },
  {
    kind: "question",
    id: "concerns",
    title: "Что вас беспокоит?",
    description: "Можно выбрать несколько вариантов.",
    type: "multi",
    required: true,
    options: ["акне", "постакне", "расширенные поры", "покраснение", "сухость"],
  },
  {
    kind: "question",
    id: "oiliness",
    title: "Насколько кожа склонна к жирности?",
    type: "single",
    required: true,
    options: ["низкая", "средняя", "высокая"],
  },
  {
    kind: "question",
    id: "primaryGoal",
    title: "Главная цель ухода на 28 дней?",
    type: "single",
    required: true,
    options: ["снять воспаления", "увлажнить", "осветлить постакне", "сузить поры"],
  },
];

// Инсайты — после каждого вопроса, начиная со 2-го (skinType)
const insightFor = (qid: QuestionStep["id"]): InsightStep => ({
  kind: "insight",
  id: `insight_${qid}`,
  forQuestionId: qid,
  title: "Небольшой инсайт",
  renderBody: (a: Answers) => {
    switch (qid) {
      case "skinType":
        return (
          <p className="opacity-80">
            Для типа кожи <b>{a.skinType ?? "—"}</b> мы осторожнее подбираем
            очищение и активы: избегаем пересушивания и соблюдаем баланс pH.
          </p>
        );
      case "sensitivity":
        return a.sensitivity ? (
          <p className="opacity-80">
            Чувствительная кожа любит мягкое очищение, SPF без отдушек и
            постепенный ввод активов.
          </p>
        ) : (
          <p className="opacity-80">
            Отлично: при отсутствии высокой чувствительности можно смелее
            использовать кислоты и ретиноиды (по схеме).
          </p>
        );
      case "concerns":
        return (
          <p className="opacity-80">
            По вашим жалобам ({(a.concerns || []).join(", ") || "—"}) мы
            настроим приоритеты: сначала — снятие воспалений/раздражений, затем
            работа с текстурой и тонизацией.
          </p>
        );
      case "oiliness":
        return (
          <p className="opacity-80">
            Уровень жирности: <b>{a.oiliness ?? "—"}</b>. Это влияет на выбор
            форматов: гели/флюиды днём, более плотное увлажнение — вечером.
          </p>
        );
      case "primaryGoal":
        return (
          <p className="opacity-80">
            Главная цель — <b>{a.primaryGoal ?? "—"}</b>. План и активы будут
            выстроены вокруг этой цели на ближайшие 28 дней.
          </p>
        );
      default:
        return null;
    }
  },
});

// Смешиваем вопросы и инсайты: Q1, (Q2, I2), (Q3, I3), ...
function buildSteps(): Step[] {
  const steps: Step[] = [];
  questionSteps.forEach((q, index) => {
    steps.push(q);
    if (index > 0) steps.push(insightFor(q.id));
  });
  return steps;
}

const ALL_STEPS = buildSteps();
const TOTAL_QUESTIONS = questionSteps.length;

// ---------- UI helpers ----------
function Progress({ currentStepIndex }: { currentStepIndex: number }) {
  // Номер вопроса для текущего шага (инсайт не увеличивает номер)
  const questionIndex = useMemo(() => {
    const upto = ALL_STEPS.slice(0, currentStepIndex + 1);
    return upto.filter((s) => s.kind === "question").length; // 1..6
  }, [currentStepIndex]);

  const percent = Math.round((questionIndex / TOTAL_QUESTIONS) * 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>Шаг {questionIndex} из {TOTAL_QUESTIONS}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full bg-neutral-200 rounded">
        <div
          className="h-2 bg-black rounded"
          style={{ width: `${percent}%` }}
          aria-label="Прогресс анкеты"
        />
      </div>
    </div>
  );
}

function SingleSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-4 py-3 rounded-xl border transition text-left ${
              active ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MultiTags({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string[];
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value || []);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = set.has(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = new Set(set);
              if (active) next.delete(opt);
              else next.add(opt);
              onChange(Array.from(next));
            }}
            className={`px-3 py-2 rounded-full border text-sm transition ${
              active ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  labelYes = "Да",
  labelNo = "Нет",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelYes?: string;
  labelNo?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${!checked ? "font-semibold" : "opacity-60"}`}>{labelNo}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${
          checked ? "bg-black" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className={`text-sm ${checked ? "font-semibold" : "opacity-60"}`}>{labelYes}</span>
    </div>
  );
}

// ---------- Main component ----------
export default function Quiz() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>(() => loadAnswersLS());
  const [stepIndex, setStepIndex] = useState(0);

  // сохранение в LS при каждом изменении
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(answers));
  }, [answers]);

  const step = ALL_STEPS[stepIndex];

  // Валидация текущего «вопросного» шага
  const isCurrentQuestionValid = useMemo(() => {
    if (step.kind !== "question") return true;
    switch (step.id) {
      case "name":
        if (step.needsConsent && !answers.pdConsent) return false;
        return Boolean(answers.name && answers.name.trim().length > 0);
      case "skinType":
        return Boolean(answers.skinType);
      case "sensitivity":
        return typeof answers.sensitivity === "boolean";
      case "concerns":
        return Array.isArray(answers.concerns) && answers.concerns.length > 0;
      case "oiliness":
        return Boolean(answers.oiliness);
      case "primaryGoal":
        return Boolean(answers.primaryGoal);
      default:
        return false;
    }
  }, [step, answers]);

  const onNext = () => {
    if (stepIndex < ALL_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      // завершение анкеты → дальше по флоу (например, к плану или к оплате)
      navigate("/plan");
    }
  };

  const onBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  // Рендер вопроса по типу
  const renderQuestionBody = (q: QuestionStep) => {
    switch (q.id) {
      case "name":
        return (
          <>
            <input
              autoFocus
              type="text"
              placeholder="Введите имя"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-black"
              value={answers.name ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, name: e.target.value }))}
            />
            <label className="flex items-start gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={!!answers.pdConsent}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, pdConsent: e.target.checked }))
                }
              />
              <span>
                Я согласен(-на) на обработку персональных данных.
              </span>
            </label>
          </>
        );

      case "skinType":
        return (
          <SingleSelect
            options={q.options!}
            value={answers.skinType}
            onChange={(v) => setAnswers((p) => ({ ...p, skinType: v as Answers["skinType"] }))}
          />
        );

      case "sensitivity":
        return (
          <Switch
            checked={!!answers.sensitivity}
            onChange={(v) => setAnswers((p) => ({ ...p, sensitivity: v }))}
            labelNo="Нет"
            labelYes="Да"
          />
        );

      case "concerns":
        return (
          <MultiTags
            options={q.options!}
            value={answers.concerns}
            onChange={(v) => setAnswers((p) => ({ ...p, concerns: v }))}
          />
        );

      case "oiliness":
        return (
          <SingleSelect
            options={q.options!}
            value={answers.oiliness}
            onChange={(v) => setAnswers((p) => ({ ...p, oiliness: v as Answers["oiliness"] }))}
          />
        );

      case "primaryGoal":
        return (
          <SingleSelect
            options={q.options!}
            value={answers.primaryGoal}
            onChange={(v) =>
              setAnswers((p) => ({ ...p, primaryGoal: v as Answers["primaryGoal"] }))
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm underline opacity-70 hover:opacity-100 disabled:opacity-40"
        disabled={stepIndex === 0}
        aria-label="Назад"
      >
        ← Назад
      </button>

      <Progress currentStepIndex={stepIndex} />

      <section className="rounded-2xl p-5 border border-neutral-200">
        {step.kind === "question" ? (
          <>
            <h1 className="text-xl md:text-2xl font-semibold mb-2">{step.title}</h1>
            {step.description && (
              <p className="opacity-70 mb-4">{step.description}</p>
            )}
            <div className="mb-6">{renderQuestionBody(step)}</div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onNext}
                disabled={!isCurrentQuestionValid}
                className={`rounded-xl px-4 py-2 border transition ${
                  isCurrentQuestionValid
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
            <h2 className="text-xl md:text-2xl font-semibold mb-2">{step.title}</h2>
            <div className="mb-6">{step.renderBody(answers)}</div>
            <button
              type="button"
              onClick={onNext}
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

