import { useMemo, useState } from "react";

// утилита для классов
function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

// универсальная кнопка
function UIButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "h-12 w-full rounded-btn text-base font-semibold transition active:scale-[0.99]",
        variant === "primary"
          ? "bg-primary text-white shadow-e1 hover:opacity-95"
          : "border border-neutral-200 bg-surface text-ink",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [goals, setGoals] = useState<string[]>([]);

  const OPTIONS = useMemo(
    () => [
      "Высыпания/комедоны",
      "Пост-акне/пятна",
      "Сухость/шелушение",
      "Жирность/поры",
      "Покраснение/чувствительность",
      "Ровный тон/сияние",
      "Анти-эйдж",
    ],
    []
  );

  const toggle = (val: string) => {
    setGoals((prev) => {
      if (prev.includes(val)) return prev.filter((x) => x !== val);
      if (prev.length >= 3) return prev; // лимит 3
      return [...prev, val];
    });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen p-4 space-y-4">
      {/* STEP 0 — Welcome */}
      {step === 0 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">SkinPlan</h1>
          <p className="text-sm text-muted">
            Персональный уход • план на 28 дней
          </p>
          <UIButton onClick={() => setStep(1)}>Начать подбор</UIButton>
        </div>
      )}

      {/* STEP 1 — Goals */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Цели (1/12)</h2>
            <span className="text-sm text-muted">{goals.length}/3</span>
          </div>
          <p className="text-sm text-muted">Выбери до трёх</p>

          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map((o) => {
              const active = goals.includes(o);
              return (
                <button
                  type="button"
                  key={o}
                  onClick={() => toggle(o)}
                  className={cx(
                    "p-4 rounded-card border text-left transition",
                    "bg-surface shadow-e1",
                    active
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cx(
                        "w-4 h-4 rounded",
                        active ? "bg-primary" : "bg-neutral-200"
                      )}
                    />
                    <span className="text-sm">{o}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <UIButton variant="ghost" onClick={() => setStep(0)} className="w-1/2">
              Назад
            </UIButton>
            <UIButton
              onClick={() => setStep(2)}
              disabled={goals.length === 0}
              className="w-1/2"
            >
              ✅ Готово
            </UIButton>
          </div>
        </div>
      )}

      {/* STEP 2 — Plan Preview */}
      {step === 2 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">План 28 дней</h2>
          <p className="text-sm text-muted">
            A — актив • B — барьер • Rest — отдых
          </p>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, i) => {
              const pattern = ["A", "B", "Rest", "A", "B", "Rest", "B"] as const;
              const badge = pattern[i % 7];
              const badgeStyle =
                badge === "A"
                  ? "bg-[#E8EAFF] text-primary"
                  : badge === "B"
                  ? "bg-sage text-sageInk"
                  : "bg-neutral-100 text-muted";
              return (
                <div
                  key={i}
                  className="rounded-card bg-surface text-sm p-2 text-center shadow-e1 border border-neutral-200"
                >
                  <div className="text-xs text-muted">{i + 1}</div>
                  <div className={cx("mt-2 px-2 py-1 rounded-full text-[11px]", badgeStyle)}>
                    {badge}
                  </div>
                </div>
              );
            })}
          </div>

          <UIButton onClick={() => setStep(3)}>Скачать PDF-план</UIButton>
        </div>
      )}

      {/* STEP 3 — Success */}
      {step === 3 && (
        <div className="space-y-3 text-center pt-10">
          <h2 className="text-3xl font-extrabold">Готово!</h2>
          <p className="text-lg text-ink/80">План отправлен в чат</p>
          <div className="pt-6">
            <UIButton variant="ghost" onClick={() => setStep(0)} className="w-auto px-6">
              На главную
            </UIButton>
          </div>
        </div>
      )}
    </div>
  );
}
