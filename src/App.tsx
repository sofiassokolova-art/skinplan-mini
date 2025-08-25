// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ---------- TG SDK helper ---------- */
const tg =
  typeof window !== "undefined" && (window as any).Telegram
    ? (window as any).Telegram.WebApp
    : null;
const cx = (...cls: (string | false | undefined)[]) => cls.filter(Boolean).join(" ");

/** ---------- Types ---------- */
type SuggItem = { n: string; b: "low" | "mid" | "high" };
type Plan = {
  detected_type: "normal" | "oily" | "combo" | "dry";
  sensitivity: boolean;
  goals: string[];
  budget: "low" | "mid" | "high";
  routine: { am: string[]; pm: string[] };
  picks: {
    cleanser: string | undefined;
    moisturizer: string | undefined;
    barrier: string | undefined;
    spf: string | undefined;
    actives: string[];
  };
  schedule28: any[];
  cart: { role: string; name: string }[];
  coverage: Record<string, boolean>;
  conflictRules: { id: string; test: string; msg: string }[];
  notes: string[];
};

/** ---------- UI atoms ---------- */
function ProgressStep({ idx, total }: { idx: number; total: number }) {
  const pct = Math.round(((idx + 1) / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 text-zinc-500">
        <span>Шаг {idx + 1}/{total}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden shadow-inner">
        <div className="h-3 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const Card = ({
  title,
  subtitle,
  children,
  help,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  help?: React.ReactNode;
}) => (
  <div className="p-6 rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_6px_30px_rgba(0,0,0,0.06)]">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {help && (
        <details className="text-sm text-indigo-700 cursor-pointer select-none">
          <summary className="list-none underline decoration-dotted">Помощь</summary>
          <div className="max-w-prose pt-2 text-zinc-700">{help}</div>
        </details>
      )}
    </div>
    {children}
  </div>
);

interface ToggleItem {
  label: string;
  key: string;
}
function ToggleList({
  items,
  value = [],
  onChange,
  doneLabel = "Готово",
  onDone,
  exclusiveKey,
}: {
  items: ToggleItem[];
  value?: string[];
  onChange: (arr: string[]) => void;
  doneLabel?: string;
  onDone?: () => void;
  exclusiveKey?: string;
}) {
  const isOn = (k: string) => value.includes(k);
  const toggle = (k: string) => {
    let next = new Set(value);
    if (exclusiveKey && k === exclusiveKey) {
      next = new Set([exclusiveKey]);
    } else {
      if (exclusiveKey && next.has(exclusiveKey)) next.delete(exclusiveKey);
      next.has(k) ? next.delete(k) : next.add(k);
    }
    onChange(Array.from(next));
  };
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => toggle(it.key)}
          className={cx(
            "w-full text-left px-4 py-3 rounded-2xl border shadow-sm transition-all",
            isOn(it.key)
              ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
              : "border-white/70 bg-white/60 hover:bg-white/80"
          )}
        >
          {(isOn(it.key) ? "✓" : "•") + " " + it.label}
        </button>
      ))}
      {onDone && (
        <button
          onClick={onDone}
          className="w-full mt-3 px-5 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold shadow-[0_10px_20px_rgba(99,102,241,0.25)]"
        >
          {doneLabel}
        </button>
      )}
    </div>
  );
}

/** ---------- Suggestions (mutable arrays to avoid readonly typing issues) ---------- */
const SUGG = {
  base: {
    cleanser: {
      dry: [
        { n: "CeraVe Hydrating Cleanser", b: "low" },
        { n: "La Roche-Posay Toleriane Dermo-Cleanser", b: "mid" },
      ] as SuggItem[],
      normal: [{ n: "CeraVe Hydrating/Foaming", b: "low" }] as SuggItem[],
      combo: [
        { n: "CeraVe Foaming Cleanser", b: "low" },
        { n: "La Roche-Posay Effaclar Gel", b: "mid" },
      ] as SuggItem[],
      oily: [
        { n: "Bioderma Sebium Gel", b: "mid" },
        { n: "CeraVe SA Cleanser", b: "mid" },
      ] as SuggItem[],
    },
    moisturizer: {
      dry: [
        { n: "CeraVe Moisturizing Cream", b: "low" },
        { n: "La Roche-Posay Lipikar AP+M", b: "mid" },
      ] as SuggItem[],
      normal: [
        { n: "CeraVe PM", b: "low" },
        { n: "LRP Toleriane Sensitive", b: "mid" },
      ] as SuggItem[],
      combo: [
        { n: "Uriage Eau Thermale Light", b: "mid" },
        { n: "LRP Effaclar H/Mat", b: "mid" },
      ] as SuggItem[],
      oily: [
        { n: "Bioderma Sebium Hydra", b: "mid" },
        { n: "LRP Effaclar Mat", b: "mid" },
      ] as SuggItem[],
    },
    spf: [
      { n: "Bioderma Photoderm", b: "mid" },
      { n: "LRP Anthelios UVMune 400", b: "high" },
      { n: "Garnier Ambre Solaire SPF50", b: "low" },
    ] as SuggItem[],
    barrier: [
      { n: "La Roche-Posay Cicaplast Baume B5", b: "mid" },
      { n: "Bepanthen Derma Repair", b: "low" },
    ] as SuggItem[],
  },
  actives: {
    azelaic: [
      { n: "The Ordinary Azelaic Acid 10%", b: "low" },
      { n: "Geek & Gorgeous Stress Less", b: "mid" },
    ] as SuggItem[],
    bha: [
      { n: "Paula's Choice BHA 2%", b: "high" },
      { n: "COSRX BHA", b: "mid" },
    ] as SuggItem[],
    vitc: [
      { n: "LRP Pure Vitamin C 10", b: "high" },
      { n: "The Ordinary AA 8%/MAP", b: "low" },
    ] as SuggItem[],
    niacin: [
      { n: "The Ordinary Niacinamide 10%", b: "low" },
      { n: "Geek & Gorgeous B-Bomb", b: "mid" },
    ] as SuggItem[],
    retinoid: [
      { n: "Geek & Gorgeous A-Game (ретиналь)", b: "mid" },
      { n: "LRP Retinol B3", b: "high" },
    ] as SuggItem[],
    ha: [
      { n: "The Ordinary Hyaluronic Acid 2%+B5", b: "low" },
      { n: "LRP Hyalu B5", b: "high" },
    ] as SuggItem[],
  },
};

/** ---------- Helpers for plan ---------- */
function detectSkinTypeFromQ(answers: any) {
  const q2 = answers.q2_skin;
  let type: "normal" | "oily" | "combo" | "dry" = "normal";
  if (q2 === "oily") type = "oily";
  else if (q2 === "combo") type = "combo";
  else if (q2 === "dry") type = "dry";
  const sensitivity = answers.q3_react === "often";
  return { type, sensitivity };
}

const pickByBudget = (budget: "low" | "mid" | "high") => {
  const order = budget === "low" ? ["low", "mid", "high"] : budget === "mid" ? ["mid", "low", "high"] : ["high", "mid", "low"];
  return (arr: SuggItem[]) => [...arr].sort((a, b) => order.indexOf(a.b) - order.indexOf(b.b))[0]?.n;
};

function buildPlan(answers: any): Plan {
  const { type, sensitivity } = detectSkinTypeFromQ(answers);
  const goals: string[] = answers.q1_goals || [];
  const concerns = new Set<string>();
  if (goals.includes("acne")) concerns.add("texture");
  if (goals.includes("postacne")) concerns.add("pigmentation");
  if (goals.includes("redness") || (answers.q7_safe || []).includes("rosacea")) concerns.add("rosacea");
  if (goals.includes("oil")) concerns.add("texture");
  if (goals.includes("dry")) concerns.add("dehydration");
  if (goals.includes("tone")) concerns.add("pigmentation");
  if (goals.includes("antiage")) concerns.add("aging");

  const budgetMap: Record<string, "low" | "mid" | "high"> = { min: "low", opt: "mid", prem: "high" };
  const budgetPref = budgetMap[answers.q10_budget as string] || "mid";

  const prefs = new Set<string>();
  (answers.q11_prefs || []).forEach((p: string) => {
    if (p === "ff") prefs.add("fragrancefree");
    if (p === "light") prefs.add("light");
    if (p === "noalcoeo") prefs.add("noalcoeo");
    if (p === "vegan") prefs.add("vegan");
  });
  if ((answers.q7_safe || []).includes("preg")) prefs.add("pregsafe");

  const wantsMild = sensitivity || prefs.has("pregsafe") || (answers.q7_safe || []).length > 0;

  type Active = { id: string; name: string; when: string; strength: number };
  const activePool: Active[] = [];
  if (concerns.has("dehydration")) activePool.push({ id: "ha", name: "Гиалуроновая сыворотка/эссенция", when: "AM/PM", strength: 0 });
  if (concerns.has("pigmentation"))
    activePool.push({
      id: wantsMild ? "azelaic" : "vitc",
      name: wantsMild ? "Азелаиновая кислота 10%" : "Витамин C 8–15%",
      when: "AM",
      strength: wantsMild ? 2 : 1,
    });
  if (goals.includes("acne") || concerns.has("texture"))
    activePool.push({
      id: wantsMild ? "azelaic" : "bha",
      name: wantsMild ? "Азелаиновая кислота 10%" : "Салициловая кислота (BHA) 1–2%",
      when: "PM alt",
      strength: wantsMild ? 2 : 3,
    });
  if (concerns.has("aging") && !prefs.has("pregsafe"))
    activePool.push({
      id: "retinoid",
      name: sensitivity ? "Ретиналь/ретинол 0.1–0.3%" : "Ретиноид (ретиналь/ретинол)",
      when: "PM",
      strength: 4,
    });
  if (concerns.has("rosacea")) activePool.push({ id: "niacin", name: "Ниацинамид 4–10%", when: "AM/PM", strength: 1 });

  const amTime = answers.q9_am || "4_7";
  const pmTime = answers.q9_pm || "4_7";
  const compactAM = amTime === "1_3";
  const richPM = pmTime === "8p";
  const compactPM = pmTime === "1_3";

  const am: string[] = [compactAM ? "Нежное очищение" : "Очищение"];
  const amActive = activePool.find((a) => a.when.includes("AM") && a.id !== "retinoid" && a.id !== "bha");
  if (!compactAM && amActive) am.push(amActive.name);
  am.push("Увлажнение", "SPF 30–50");

  const pm: string[] = [];
  if (richPM && !compactPM) pm.push("Демакияж/масло");
  pm.push("Очищение");
  const pmActive =
    activePool.find((a) => a.when.includes("PM") && a.id !== "ha") || activePool.find((a) => a.when.includes("PM alt"));
  if (!compactPM && pmActive) pm.push(pmActive.name);
  pm.push("Крем/бальзам");

  const pick = pickByBudget(budgetPref);

  const picks = {
    cleanser: pick((SUGG.base.cleanser as any)[type] || SUGG.base.cleanser.normal),
    moisturizer: pick((SUGG.base.moisturizer as any)[type] || SUGG.base.moisturizer.normal),
    barrier: pick(SUGG.base.barrier),
    spf: pick(SUGG.base.spf),
    actives: [] as string[],
  };
  const activeMap: Record<string, SuggItem[]> = {
    azelaic: SUGG.actives.azelaic,
    bha: SUGG.actives.bha,
    vitc: SUGG.actives.vitc,
    niacin: SUGG.actives.niacin,
    retinoid: SUGG.actives.retinoid,
    ha: SUGG.actives.ha,
  };
  activePool.forEach((a) => {
    const list = activeMap[a.id];
    if (list) picks.actives.push(pick(list)!);
  });

  const notes: string[] = [];
  if (sensitivity) notes.push("Начинайте активы через день, патч-тест перед первым применением.");
  if ((answers.q7_safe || []).includes("rosacea")) notes.push("Избегайте горячей воды, спиртов/отдушек, резких кислот.");
  if (goals.includes("acne")) notes.push("BHA 1–2 раза в неделю, не выдавливайте воспаления.");

  const phases = ["A", "B", "Rest"] as const;
  const schedule28 = Array.from({ length: 28 }, (_, i) => ({
    day: i + 1,
    am: { phase: "Base", steps: am },
    pm: {
      phase: phases[i % 3],
      steps:
        phases[i % 3] === "A"
          ? ["Очищение", picks.actives[0] || "Актив", "Крем"]
          : phases[i % 3] === "B"
          ? ["Очищение", picks.actives[1] || picks.barrier, "Крем/бальзам"]
          : ["Очищение", picks.barrier],
    },
  }));

  const cart: { role: string; name: string }[] = [];
  const pushOnce = (role: string, name?: string) => {
    if (name && !cart.find((x) => x.role === role)) cart.push({ role, name });
  };
  pushOnce("cleanser", picks.cleanser);
  pushOnce("moisturizer", picks.moisturizer);
  pushOnce("spf", picks.spf);
  pushOnce("barrier", picks.barrier);
  pushOnce("activeA", picks.actives[0]);
  pushOnce("activeB", picks.actives[1]);

  const coverage = ["cleanser", "moisturizer", "spf", "barrier", "activeA", "activeB"].reduce((acc: Record<string, boolean>, k) => {
    acc[k] = !!cart.find((x) => x.role === k);
    return acc;
  }, {});

  const conflictRules = [
    { id: "retinoid+acidsPM", test: "tags.retinoid && (tags.aha || tags.bha)", msg: "Не сочетайте ретиноид с AHA/BHA в одну ночь. Разведите по дням." },
    { id: "bpo+vitcAM", test: "tags.bpo && tags.vitc && context.am && !context.spf", msg: "BPO с витамином C утром без SPF — риск раздражения/оксидации." },
    { id: "multiAcids", test: "tags.aha && tags.bha", msg: "Две кислоты одновременно — сократите до одной." },
    { id: "dupActives", test: "tags.dup > 0", msg: "Дубли активов одной группы. Оставьте один продукт на роль." },
  ];

  return { detected_type: type, sensitivity, goals, budget: budgetPref, routine: { am, pm }, picks, schedule28, cart, coverage, conflictRules, notes };
}

/** ---------- LocalStorage helpers ---------- */
const LS = {
  getPlans(): Plan[] {
    try {
      return JSON.parse(localStorage.getItem("plans") || "[]");
    } catch {
      return [];
    }
  },
  savePlan(p: Plan) {
    const arr = LS.getPlans();
    arr.unshift(p);
    localStorage.setItem("plans", JSON.stringify(arr.slice(0, 20)));
  },
  getCart(): { name: string; role?: string }[] {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  },
  setCart(items: { name: string; role?: string }[]) {
    localStorage.setItem("cart", JSON.stringify(items));
  },
};

/** ---------- Main App ---------- */
type View = "home" | "quiz" | "result" | "cabinet" | "cart" | "consult";

export default function App() {
  const TOTAL_STEPS = 12;
  const [view, setView] = useState<View>("home");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<any>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sent, setSent] = useState(false);
  const [cart, setCart] = useState<{ name: string; role?: string }[]>(LS.getCart());
  const go = (d = 1) => setIdx((i) => Math.min(TOTAL_STEPS - 1, Math.max(0, i + d)));
  const setA = (k: string, v: any) => setAnswers((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand && tg.expand();
        tg.MainButton?.hide();
      } catch {}
    }
  }, []);

  useEffect(() => {
    LS.setCart(cart);
  }, [cart]);

  const finalize = () => {
    const p = buildPlan(answers);
    setPlan(p);
    setView("result");
  };

  const addPickToCart = () => {
    if (!plan) return;
    const items: { name: string; role?: string }[] = [];
    if (plan.picks.cleanser) items.push({ name: plan.picks.cleanser, role: "cleanser" });
    if (plan.picks.moisturizer) items.push({ name: plan.picks.moisturizer, role: "moisturizer" });
    if (plan.picks.spf) items.push({ name: plan.picks.spf, role: "spf" });
    if (plan.picks.barrier) items.push({ name: plan.picks.barrier, role: "barrier" });
    plan.picks.actives.forEach((n, i) => items.push({ name: n, role: i === 0 ? "activeA" : "activeB" }));
    const merged = [...cart];
    items.forEach((it) => {
      if (!merged.find((x) => x.name === it.name)) merged.push(it);
    });
    setCart(merged);
    setView("cart");
  };

  const sendToTelegram = (payload: any, title = "Отправлено", message = "Данные отправлены") => {
    const data = JSON.stringify(payload);
    if (tg) {
      try {
        tg.sendData(data);
        tg.showPopup?.({ title, message, buttons: [{ type: "close" }] });
        setSent(true);
      } catch (e) {
        alert("Не удалось отправить: " + (e as any).message);
      }
    } else {
      navigator.clipboard.writeText(data).then(() => setSent(true));
    }
  };

  /** ---------- Header (без RU/Telegram) ---------- */
  const Header = (
    <div className="flex items-center justify-between pb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">SkinCare Picker</h1>
        <p className="text-base text-stone-600">Подбор ухода · мягкий минимализм</p>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-full border bg-white/70 text-sm" onClick={() => setView("home")}>
          Главная
        </button>
        <button className="px-3 py-2 rounded-full border bg-white/70 text-sm" onClick={() => setView("cabinet")}>
          Личный кабинет
        </button>
        <button className="px-3 py-2 rounded-full border bg-white/70 text-sm" onClick={() => setView("cart")}>
          Корзина ({cart.length})
        </button>
        <button className="px-3 py-2 rounded-full border bg-white/70 text-sm" onClick={() => setView("consult")}>
          Консультация
        </button>
      </div>
    </div>
  );

  /** ---------- Views ---------- */

  // Home
  const Home = (
    <Card
      title="Добро пожаловать"
      subtitle="Выбери сценарий: бесплатный подбор или продолжить работу с планами."
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          className="w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold"
          onClick={() => {
            setIdx(0);
            setAnswers({});
            setView("quiz");
          }}
        >
          Начать подбор (бесплатно)
        </button>
        <button
          className="w-full px-5 py-3 rounded-2xl border bg-white/70"
          onClick={() => setView("cabinet")}
        >
          Личный кабинет
        </button>
        <button
          className="w-full px-5 py-3 rounded-2xl border bg-white/70"
          onClick={() => setView("cart")}
        >
          Корзина ({cart.length})
        </button>
        <button
          className="w-full px-5 py-3 rounded-2xl border bg-white/70"
          onClick={() => setView("consult")}
        >
          Запись на консультацию
        </button>
      </div>
    </Card>
  );

  // Cabinet
  const Cabinet = (() => {
    const plans = LS.getPlans();
    return (
      <Card title="Личный кабинет" subtitle="Мои планы">
        {plans.length === 0 ? (
          <div className="text-sm text-zinc-600">Пока нет сохранённых планов.</div>
        ) : (
          <div className="space-y-3">
            {plans.map((p, i) => (
              <div key={i} className="p-3 rounded-2xl border bg-white/70 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">План #{i + 1}</div>
                  <div className="text-zinc-600">
                    Тип: {({ dry: "сухая", normal: "нормальная", combo: "комбинированная", oily: "жирная" } as const)[p.detected_type]}
                    {p.sensitivity ? " · чувствительная" : ""}
                    {" · "}Бюджет: {p.budget}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded-full border bg-white/70 text-sm"
                    onClick={() => {
                      setPlan(p);
                      setView("result");
                    }}
                  >
                    Открыть
                  </button>
                  <button
                    className="px-3 py-2 rounded-full border bg-white/70 text-sm"
                    onClick={() => {
                      const rest = plans.filter((_, j) => j !== i);
                      localStorage.setItem("plans", JSON.stringify(rest));
                      setView("cabinet");
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  })();

  // Cart
  const Cart = (
    <Card title="Корзина продуктов" subtitle="Сохраняется на устройстве">
      {cart.length === 0 ? (
        <div className="text-sm text-zinc-600">Корзина пуста.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {cart.map((it, i) => (
            <li key={i} className="flex items-center justify-between p-2 rounded-xl border bg-white/60">
              <span>{it.role ? <b className="mr-1">{it.role}:</b> : null}{it.name}</span>
              <button
                className="px-3 py-1 rounded-full border"
                onClick={() => setCart(cart.filter((_, j) => j !== i))}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-3">
        <button
          className="px-5 py-3 rounded-2xl border bg-white/70"
          onClick={() => setCart([])}
        >
          Очистить
        </button>
        <button
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold"
          onClick={() => sendToTelegram({ type: "cart", cart }, "Корзина", "Отправлено в чат/скопировано")}
        >
          Отправить в чат
        </button>
      </div>
    </Card>
  );

  // Consult
  const Consult = (() => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [date, setDate] = useState("");
    const [comment, setComment] = useState("");
    const [ok, setOk] = useState(false);

    const submit = () => {
      const payload = { type: "consult_request", name, email, date, comment };
      if (!name || !email || !date) {
        alert("Заполни имя, почту и дату 🙏");
        return;
      }
      if (tg) {
        try {
          tg.sendData(JSON.stringify(payload));
          tg.showPopup?.({ title: "Заявка отправлена", message: "Мы свяжемся с тобой", buttons: [{ type: "close" }] });
          setOk(true);
        } catch (e) {
          alert("Не удалось отправить: " + (e as any).message);
        }
      } else {
        console.log("Consult payload:", payload);
        setOk(true);
      }
    };

    return (
      <Card title="Запись на консультацию" subtitle="Онлайн/офлайн — выберем вариант">
        {ok ? (
          <div className="text-green-700 text-sm">Заявка отправлена! Мы свяжемся с тобой по email.</div>
        ) : (
          <div className="grid gap-2">
            <input className="px-3 py-2 rounded-xl border" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="px-3 py-2 rounded-xl border" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="px-3 py-2 rounded-xl border" placeholder="Дата (напр. 2025-09-01 15:00)" value={date} onChange={(e) => setDate(e.target.value)} />
            <textarea className="px-3 py-2 rounded-xl border" placeholder="Комментарий/цели" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="pt-2">
              <button onClick={submit} className="w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold">Отправить</button>
            </div>
          </div>
        )}
      </Card>
    );
  })();

  /** ---------- Render ---------- */
  const TYPE_RU: Record<Plan["detected_type"], string> = {
    dry: "сухая",
    normal: "нормальная",
    combo: "комбинированная",
    oily: "жирная",
  };

  return (
    <div className="min-h-dvh p-5 sm:p-8 bg-gradient-to-b from-rose-50 via-amber-50 to-stone-100 text-stone-900">
      <div className="max-w-3xl mx-auto">
        {Header}

        {/* HOME */}
        {view === "home" && <>{Home}</>}

        {/* QUIZ */}
        {view === "quiz" && (
          <>
            <ProgressStep idx={idx} total={TOTAL_STEPS} />

            {/* Q1 */}
            {idx === 0 && (
              <Card title="Q1 — Цели (1/12)" subtitle="Определи цели на 4–8 недель. Выбери до 3.">
                <ToggleList
                  items={[
                    { label: "Высыпания/комедоны", key: "acne" },
                    { label: "Пост-акне/пятна", key: "postacne" },
                    { label: "Покраснение/чувствительность", key: "redness" },
                    { label: "Жирность/поры", key: "oil" },
                    { label: "Сухость/шелушение", key: "dry" },
                    { label: "Ровный тон/сияние", key: "tone" },
                    { label: "Анти-эйдж", key: "antiage" },
                  ]}
                  value={answers.q1_goals || []}
                  onChange={(arr) => (arr.length <= 3 ? setA("q1_goals", arr) : void 0)}
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q2 */}
            {idx === 1 && (
              <Card
                title="Q2 — Тип кожи (2/12)"
                subtitle="Тип кожи через 2–3 часа после умывания. Если сомневаешься — «Не знаю»."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Жирная", key: "oily" },
                    { label: "Комбинированная", key: "combo" },
                    { label: "Нормальная", key: "normal" },
                    { label: "Сухая", key: "dry" },
                    { label: "Не знаю", key: "unknown" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      onClick={() => {
                        setA("q2_skin", o.key);
                        go(+1);
                      }}
                      className={cx(
                        "px-4 py-3 rounded-2xl border text-left shadow-sm transition-all",
                        answers.q2_skin === o.key
                          ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
                          : "border-white/70 bg-white/60 hover:bg-white/80"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Q3 */}
            {idx === 2 && (
              <Card title="Q3 — Реактивность (3/12)" subtitle="Как кожа реагирует на новые средства?">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Нет", key: "none" },
                    { label: "Иногда", key: "some" },
                    { label: "Часто (жжение/зуд/покраснение)", key: "often" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      onClick={() => {
                        setA("q3_react", o.key);
                        go(+1);
                      }}
                      className={cx(
                        "px-4 py-3 rounded-2xl border text-left shadow-sm transition-all",
                        answers.q3_react === o.key
                          ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
                          : "border-white/70 bg-white/60 hover:bg-white/80"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Q4 */}
            {idx === 3 && (
              <Card title="Q4 — Зоны (4/12)" subtitle="Можно несколько.">
                <ToggleList
                  items={[
                    { label: "Лоб", key: "forehead" },
                    { label: "Нос", key: "nose" },
                    { label: "Щёки", key: "cheeks" },
                    { label: "Подбородок", key: "chin" },
                    { label: "Спина", key: "back" },
                    { label: "Плечи/грудь", key: "chest" },
                  ]}
                  value={answers.q4_zones || []}
                  onChange={(arr) => setA("q4_zones", arr)}
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q5 */}
            {idx === 4 && (
              <Card title="Q5 — База ухода (5/12)" subtitle="Что из базовых шагов уже есть?">
                <ToggleList
                  items={[
                    { label: "Очищение", key: "cleanser" },
                    { label: "Увлажнение", key: "moisturizer" },
                    { label: "SPF ежедневно", key: "spf" },
                    { label: "Ничего из списка", key: "none" },
                  ]}
                  value={answers.q5_base || []}
                  onChange={(arr) =>
                    arr.includes("none")
                      ? setA("q5_base", ["none"])
                      : setA(
                          "q5_base",
                          arr.filter((x: string) => x !== "none")
                        )
                  }
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q6 */}
            {idx === 5 && (
              <Card title="Q6 — Активы (6/12)" subtitle="Что используешь сейчас?">
                <ToggleList
                  items={[
                    { label: "Ретиноид (адапален/ретиналь/третиноин)", key: "retinoid" },
                    { label: "Кислоты AHA/BHA/PHA", key: "acids" },
                    { label: "Ниацинамид", key: "niacin" },
                    { label: "Витамин C", key: "vitc" },
                    { label: "Азелаиновая кислота", key: "azelaic" },
                    { label: "БПО", key: "bpo" },
                    { label: "Антибиотики местно", key: "abx" },
                    { label: "Ничего", key: "none" },
                  ]}
                  value={answers.q6_act || []}
                  onChange={(arr) =>
                    arr.includes("none")
                      ? setA("q6_act", ["none"])
                      : setA(
                          "q6_act",
                          arr.filter((x: string) => x !== "none")
                        )
                  }
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q7 */}
            {idx === 6 && (
              <Card title="Q7 — Safety-факторы (7/12)" subtitle="Отметь факторы.">
                <ToggleList
                  items={[
                    { label: "Беременность/ГВ/планирование", key: "preg" },
                    { label: "Розацеа", key: "rosacea" },
                    { label: "Экзема/АД/себодерматит", key: "ecz_sd" },
                    { label: "Изотретиноин внутрь", key: "iso_oral" },
                    { label: "RX-ретиноид/стероид местно", key: "rx_topical" },
                    { label: "Ничего из списка", key: "none" },
                  ]}
                  value={answers.q7_safe || []}
                  onChange={(arr) =>
                    arr.includes("none")
                      ? setA("q7_safe", ["none"])
                      : setA(
                          "q7_safe",
                          arr.filter((x: string) => x !== "none")
                        )
                  }
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q8 */}
            {idx === 7 && (
              <Card title="Q8 — Процедуры 6 мес (8/12)" subtitle="Были ли процедуры?">
                <ToggleList
                  items={[
                    { label: "Пилинги/лазеры", key: "peels_lasers" },
                    { label: "Инъекции", key: "inj" },
                    { label: "Ничего", key: "none" },
                  ]}
                  value={answers.q8_proc || []}
                  onChange={(arr) =>
                    arr.includes("none")
                      ? setA("q8_proc", ["none"])
                      : setA(
                          "q8_proc",
                          arr.filter((x: string) => x !== "none")
                        )
                  }
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q9 */}
            {idx === 8 && (
              <Card title="Q9 — Время на уход (9/12)" subtitle="Сколько времени комфортно тратить ежедневно?">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Утро 1–3 мин", key: "1_3" },
                      { label: "Утро 4–7", key: "4_7" },
                      { label: "Утро 8+", key: "8p" },
                    ].map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setA("q9_am", o.key)}
                        className={cx(
                          "px-4 py-3 rounded-2xl border text-left shadow-sm transition-all",
                          answers.q9_am === o.key
                            ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
                            : "border-white/70 bg-white/60 hover:bg-white/80"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Вечер 1–3 мин", key: "1_3" },
                      { label: "Вечер 4–7", key: "4_7" },
                      { label: "Вечер 8+", key: "8p" },
                    ].map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setA("q9_pm", o.key)}
                        className={cx(
                          "px-4 py-3 rounded-2xl border text-left shadow-sm transition-all",
                          answers.q9_pm === o.key
                            ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
                            : "border-white/70 bg-white/60 hover:bg-white/80"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => go(+1)}
                      disabled={!answers.q9_am || !answers.q9_pm}
                      className={cx(
                        "px-6 py-3 rounded-full font-semibold",
                        !answers.q9_am || !answers.q9_pm
                          ? "bg-white/60 text-stone-400 border border-white/70"
                          : "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-[0_10px_20px_rgba(99,102,241,0.25)]"
                      )}
                    >
                      Дальше
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Q10 */}
            {idx === 9 && (
              <Card title="Q10 — Бюджет (10/12)" subtitle="Ориентир по бюджету.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Минимум", key: "min" },
                    { label: "Оптимум", key: "opt" },
                    { label: "Премиум", key: "prem" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      onClick={() => {
                        setA("q10_budget", o.key);
                        go(+1);
                      }}
                      className={cx(
                        "px-4 py-3 rounded-2xl border text-left shadow-sm transition-all",
                        answers.q10_budget === o.key
                          ? "border-indigo-400/60 bg-indigo-50/70 ring-2 ring-indigo-400/20"
                          : "border-white/70 bg-white/60 hover:bg-white/80"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Q11 */}
            {idx === 10 && (
              <Card title="Q11 — Предпочтения к формулам (11/12)" subtitle="Можно пропустить.">
                <ToggleList
                  items={[
                    { label: "Без отдушек", key: "ff" },
                    { label: "Не липко/лёгкие текстуры", key: "light" },
                    { label: "Без спирта/эфирных масел", key: "noalcoeo" },
                    { label: "Веган/CF", key: "vegan" },
                    { label: "Нет предпочтений", key: "none" },
                  ]}
                  value={answers.q11_prefs || []}
                  onChange={(arr) =>
                    arr.includes("none")
                      ? setA("q11_prefs", ["none"])
                      : setA(
                          "q11_prefs",
                          arr.filter((x: string) => x !== "none")
                        )
                  }
                  onDone={() => go(+1)}
                />
              </Card>
            )}

            {/* Q12 — Итог подготовки */}
            {idx === 11 && (
              <Card title="Итог (12/12)" subtitle="Проверь ответы и сгенерируй план">
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="font-semibold mb-1">Кратко</div>
                    <ul className="list-disc pl-5">
                      <li>Цели: {(answers.q1_goals || []).join(", ") || "—"}</li>
                      <li>Тип кожи: {answers.q2_skin || "—"} · Реактивность: {answers.q3_react || "—"}</li>
                      <li>Время: AM {answers.q9_am || "—"} / PM {answers.q9_pm || "—"}</li>
                      <li>Бюджет: {answers.q10_budget || "—"}</li>
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={finalize}
                      className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold shadow-[0_10px_20px_rgba(99,102,241,0.25)]"
                    >
                      Сформировать план
                    </button>
                    <button
                      onClick={() => setIdx(0)}
                      className="px-4 py-2 rounded-full border border-white/70 bg-white/60 backdrop-blur shadow-sm"
                    >
                      С начала
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Навигация */}
            <div className="flex justify-between mt-4">
              <button
                onClick={() => go(-1)}
                disabled={idx === 0}
                className={cx(
                  "px-4 py-2 rounded-full border",
                  idx === 0 ? "border-white/70 bg-white/50 text-stone-400" : "border-white/70 bg-white/60 backdrop-blur shadow-sm"
                )}
              >
                Назад
              </button>
              {idx < TOTAL_STEPS - 1 && idx !== 8 && idx !== 9 && idx !== 10 && (
                <button
                  onClick={() => go(+1)}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold shadow-[0_10px_20px_rgba(99,102,241,0.25)]"
                >
                  Далее
                </button>
              )}
            </div>
          </>
        )}

        {/* RESULT */}
        {view === "result" && plan && (
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 p-4 rounded-2xl border bg-white border-zinc-200">
              <h3 className="text-lg font-bold mb-1">Ваш план</h3>
              <div className="text-sm text-zinc-600 mb-3">
                Тип: <b>{TYPE_RU[plan.detected_type]}</b> {plan.sensitivity && <span>· чувствительная</span>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="font-semibold mb-2">Утро</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">{plan.routine.am.map((s, i) => (<li key={i}>{s}</li>))}</ul>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="font-semibold mb-2">Вечер</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">{plan.routine.pm.map((s, i) => (<li key={i}>{s}</li>))}</ul>
                </div>
              </div>
              <div className="mt-4">
                <div className="font-semibold mb-2">Примечания</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">{(plan.notes.length ? plan.notes : ["Используйте SPF ежедневно."]).map((n, i) => (<li key={i}>{n}</li>))}</ul>
              </div>
              <div className="mt-4">
                <div className="font-semibold mb-2">Умный план 28 дней</div>
                <div className="text-xs text-zinc-600 mb-2">
                  PM-фазы: <b>A</b> — активная ночь, <b>B</b> — барьерная/мягкая, <b>Rest</b> — отдых.
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {plan.schedule28.slice(0, 7).map((d: any) => (
                    <li key={d.day}>День {d.day}: PM — {d.pm.phase}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="p-4 rounded-2xl border bg-white border-zinc-200">
              <div className="font-semibold mb-2">Подбор продуктов</div>
              <div className="text-xs text-zinc-500 mb-3">Бюджет: {plan.budget}</div>
              <ul className="space-y-2 text-sm">
                <li><span className="font-medium">Очищение:</span> {plan.picks.cleanser}</li>
                <li><span className="font-medium">Крем:</span> {plan.picks.moisturizer}</li>
                <li><span className="font-medium">SPF:</span> {plan.picks.spf}</li>
                <li><span className="font-medium">Барьер на ночь:</span> {plan.picks.barrier}</li>
              </ul>
              {plan.picks.actives?.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-1">Активы:</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">{plan.picks.actives.map((a, i) => (<li key={i}>{a}</li>))}</ul>
                </div>
              )}

              <div className="mt-4">
                <div className="font-semibold mb-1">Корзина без дублей</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">{plan.cart.map((it, i) => (<li key={i}><b>{it.role}:</b> {it.name}</li>))}</ul>
                <div className="text-xs text-zinc-500 mt-1">
                  Покрытие ролей: {Object.entries(plan.coverage).map(([k, v]) => `${k}:${v ? "✓" : "—"}`).join(" · ")}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    LS.savePlan(plan);
                    setView("cabinet");
                  }}
                  className="w-full px-4 py-2 rounded-full border border-white/70 bg-white/60 backdrop-blur shadow-sm"
                >
                  Сохранить в личный кабинет
                </button>
                <button
                  onClick={addPickToCart}
                  className="w-full px-4 py-2 rounded-full border border-white/70 bg-white/60 backdrop-blur shadow-sm"
                >
                  Добавить всё в корзину
                </button>
                <button
                  onClick={() => sendToTelegram({ type: "skincare_plan", answers, plan }, "План отправлен", "План отправлен в чат/скопирован")}
                  className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold"
                >
                  Отправить в чат
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full px-4 py-2 rounded-full border border-white/70 bg-white/60 backdrop-blur shadow-sm"
                >
                  Скачать/распечатать
                </button>
                {sent && <div className="text-xs text-green-600">Готово! Данные отправлены/скопированы.</div>}
              </div>
            </div>
          </div>
        )}

        {/* CABINET / CART / CONSULT */}
        {view === "cabinet" && Cabinet}
        {view === "cart" && Cart}
        {view === "consult" && Consult}
      </div>
    </div>
  );
}

