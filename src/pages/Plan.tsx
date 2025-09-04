import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Answers } from "./Quiz";
import { generatePlanPDF, generatePlanPDFFromHTML } from "../lib/pdfGenerator";
type Budget = 'low' | 'mid' | 'high';
type PickItem = { n: string; b: Budget };
type AnyPick = { n: string; b: string };

const getAnswers = (): Answers | null => {
  try { const raw = localStorage.getItem("skinplan_answers"); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};

const CATALOG = {
  cleanser: {
    gel:   [{n:"CeraVe Foaming Cleanser", b:"mid"}, {n:"COSRX Low pH Good Morning", b:"mid"}, {n:"Garnier Micellar Gel", b:"low"}] as PickItem[],
    milk:  [{n:"La Roche-Posay Toleriane Dermo-Cleanser", b:"high"}, {n:"Bioderma Sensibio", b:"mid"}],
    oil:   [{n:"Hada Labo Cleansing Oil", b:"mid"}, {n:"Heimish All Clean Balm", b:"mid"}],
  },
  moisturizer: [{n:"CeraVe Moisturizing Cream", b:"mid"}, {n:"La Roche-Posay Toleriane Sensitive", b:"high"}, {n:"The Ordinary Natural Moisturizing Factors", b:"low"}] as PickItem[],
  spf: [{n:"LRP Anthelios UVMune 400", b:"high"}, {n:"Bioderma Photoderm", b:"mid"}, {n:"Garnier Ambre Solaire SPF50", b:"low"}] as PickItem[],
  barrier: [{n:"La Roche-Posay Cicaplast Baume B5", b:"mid"}, {n:"Bepanthen Derma Repair", b:"low"}] as PickItem[],
  actives: {
    azelaic: [{n:"The Ordinary Azelaic Acid 10%", b:"low"}, {n:"Geek & Gorgeous Azelaic", b:"mid"}] as PickItem[],
    bha:     [{n:"Paula's Choice BHA 2%", b:"high"}, {n:"COSRX BHA", b:"mid"}] as PickItem[],
    vitc:    [{n:"La Roche-Posay Pure Vitamin C 10", b:"high"}, {n:"The Ordinary AA 8%/MAP", b:"low"}] as PickItem[],
    niacin:  [{n:"Geek & Gorgeous B-Bomb", b:"mid"}, {n:"The Ordinary Niacinamide 10%", b:"low"}] as PickItem[],
    retinoid:[{n:"Geek & Gorgeous A-Game (ретиналь)", b:"mid"}, {n:"La Roche-Posay Retinol B3", b:"high"}] as PickItem[],
    ha:      [{n:"The Ordinary Hyaluronic Acid 2%+B5", b:"low"}, {n:"LRP Hyalu B5", b:"high"}] as PickItem[],
  }
};

const byBudget = (arr: ReadonlyArray<AnyPick>, b: Budget) => {
  const order =
    b === 'low' ? ['low', 'mid', 'high'] :
    b === 'mid' ? ['mid', 'low', 'high'] :
                  ['high', 'mid', 'low'];
  return [...arr]
    .sort((x, y) => order.indexOf(x.b as Budget) - order.indexOf(y.b as Budget))[0]?.n ?? '';
};

type DayPlan = { morning:string[]; evening:string[] };
type FullPlan = { products:Record<string,string>; days:DayPlan[]; notes:string[] };

function buildPlan(a: Answers): FullPlan {
  // Маппинг нового бюджета на старый
  const budgetMap = {
    "light": "low" as Budget,
    "affordable": "mid" as Budget,
    "high_end": "high" as Budget,
    "elite": "high" as Budget
  };
  const b = budgetMap[a.budget as keyof typeof budgetMap] ?? (a.budget as Budget) ?? "mid" as Budget;
  
  // Определяем предпочтения очищения на основе типа кожи и ощущений
  let cleansingPref = a.cleansing_pref ?? "gel";
  if (!cleansingPref) {
    if (a.after_cleansing === "tight" || a.skin_concerns.includes("dryness")) {
      cleansingPref = "milk";
    } else if (a.skin_concerns.includes("oily_shine") || a.daily_behavior === "oily_2-3h") {
      cleansingPref = "gel";
    } else {
      cleansingPref = "gel";
    }
  }
  
  const cleanserList = CATALOG.cleanser[cleansingPref] ?? CATALOG.cleanser.gel;

  const products: Record<string,string> = {
    cleanser: byBudget(cleanserList, b),
    moisturizer: byBudget(CATALOG.moisturizer, b),
    spf: byBudget(CATALOG.spf, b),
    barrier: byBudget(CATALOG.barrier, b),
  };

  const avoid = new Set(a.actives_no);
  const ok = new Set(a.actives_ok);
  const pickActive = (key:"azelaic"|"bha"|"vitc"|"niacin"|"retinoid"|"ha") => byBudget(CATALOG.actives[key], b);

  let activeA = ok.has("vitc") && !avoid.has("vitc") ? pickActive("vitc")
              : ok.has("niacin") && !avoid.has("niacin") ? pickActive("niacin")
              : pickActive("azelaic");

  // Маппинг новых полей на старую логику  
  const hasRedness = a.skin_concerns.includes("redness") || a.sensitivity_level === "high";
  const isSensitive = a.sensitivity_level === "high" || a.sensitivity_level === "medium";
  const hasIsotretinoin = a.oral_medications.includes("isotretinoin");
  
  // Маппинг беременности
  const isPregnant = a.pregnancy_status === "pregnant" || a.pregnancy_status === "breastfeeding" || a.pregnancy;
  
  let activeB = (!isPregnant && !avoid.has("retinoid")) ? pickActive("retinoid")
              : (!avoid.has("bha")) ? pickActive("bha")
              : pickActive("azelaic");

  if (isSensitive) {
    if (!avoid.has("niacin")) activeA = pickActive("niacin");
    if (!avoid.has("azelaic")) activeB = pickActive("azelaic");
  }

  products["activeA"] = activeA;
  products["activeB"] = activeB;

  const notes: string[] = [];
  
  if (hasRedness || isSensitive) notes.push("Стартуем «через день», патч-тест перед первым применением активов.");
  if (a.spf_use !== "daily") notes.push("Добавь ежедневный SPF — это ключ к пост-акне и фотостарению.");
  if (hasIsotretinoin) notes.push("Изотретиноин — исключим ретиноид и сильные кислоты; упор на барьер.");

  const days: DayPlan[] = [];
  // Маппинг для обезвоживания
  const hasDehydration = a.skin_concerns.includes("dryness") || a.after_cleansing === "tight";
  
  for (let i=1;i<=28;i++) {
    const isEven = i%2===0;
    const week = Math.ceil(i/7);
    const morning: string[] = ["Очищение ("+products.cleanser+")"];
    if (!isSensitive && week>=2 && !hasDehydration) morning.push("Актив A ("+products.activeA+")");
    morning.push("SPF ("+products.spf+")");
    const evening: string[] = ["Очищение ("+products.cleanser+")"];
    if ((isSensitive ? (week>=3 && isEven) : (week>=2))) evening.push("Актив B ("+products.activeB+")");
    evening.push("Крем/барьер ("+products.moisturizer+")");
    if (hasDehydration || hasRedness) evening.push("Барьерная поддержка ("+products.barrier+")");
    if (week===1) { morning.splice(1,1); if (evening.length>1) evening.splice(1,1); }
    days.push({morning, evening});
  }

  return { products, days, notes };
}

type CartItem = { id:string; name:string; qty:number; feedback?:string };

export default function Plan() {
  const navigate = useNavigate();
  const ans = getAnswers();
  const plan = useMemo(()=> ans ? buildPlan(ans) : null, [ans]);

  if (!ans || !plan) {
    return (
      <div className="max-w-3xl mx-auto bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-lg font-bold mb-2">План недоступен</h2>
        <p className="text-zinc-700">Сначала пройди анкету — затем я соберу план автоматически.</p>
        <button onClick={() => navigate("/quiz")} className="inline-block mt-4 px-5 py-3 rounded-full bg-black text-white hover:bg-stone-800 transition">К анкете</button>
      </div>
    );
  }

  const TYPE_RU: any = { dry:"сухая", normal:"нормальная", combo:"комбинированная", oily:"жирная" };

  const addAllToCart = () => {
    const list: CartItem[] = [
      { id:"cleanser", name: plan.products.cleanser, qty:1 },
      { id:"moisturizer", name: plan.products.moisturizer, qty:1 },
      { id:"spf", name: plan.products.spf, qty:1 },
      { id:"barrier", name: plan.products.barrier, qty:1 },
      { id:"activeA", name: plan.products.activeA, qty:1 },
      { id:"activeB", name: plan.products.activeB, qty:1 },
    ];
    
    console.log('Добавляем в корзину:', list);
    localStorage.setItem("skinplan_cart", JSON.stringify(list));
    
    // Проверяем, что данные сохранились
    const saved = localStorage.getItem("skinplan_cart");
    console.log('Сохранено в localStorage:', saved);
    
    navigate("/cart");
  };

  const downloadPDF = async () => {
    const planData = {
      profile: {
        skinType: ans.skin_type ? TYPE_RU[ans.skin_type] : undefined,
        goals: ans.skin_concerns.length > 0 ? ans.skin_concerns : (ans.goals || []),
        sensitivity: ans.sensitivity_level === "high" || ans.sensitivity,
        notes: plan.notes
      },
      products: plan.products,
      days: plan.days
    };

    await generatePlanPDF(planData);
  };

  const downloadPDFFromHTML = async () => {
    await generatePlanPDFFromHTML('plan-content');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div id="plan-content" className="space-y-6">
      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-xl font-bold mb-2">Итоговый профиль</h2>
        <div className="text-zinc-700">
          {ans.age && <div>Возраст: <b>{ans.age}</b></div>}
          {ans.skin_concerns.length>0 && <div>Основные проблемы: <b>{ans.skin_concerns.join(", ")}</b></div>}
          {ans.sensitivity_level && <div>Чувствительность: <b>{ans.sensitivity_level}</b></div>}
          {ans.budget && <div>Бюджет: <b>{ans.budget}</b></div>}
          {ans.pregnancy_status && ans.pregnancy_status !== "none" && <div className="text-amber-600">Особые условия: <b>{ans.pregnancy_status}</b></div>}
          {/* Совместимость со старыми полями */}
          {ans.skin_type && <div>Тип кожи: <b>{TYPE_RU[ans.skin_type]}</b></div>}
          {ans.goals.length>0 && <div>Цели: {ans.goals.join(", ")}</div>}
          {ans.sensitivity && <div>Чувствительная кожа — частота активов снижена.</div>}
          {plan.notes.length>0 && <ul className="list-disc pl-5 mt-2">{plan.notes.map((n,i)=><li key={i}>{n}</li>)}</ul>}
        </div>
      </section>

      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-3">Подобранные продукты</h3>
        <ul className="grid sm:grid-cols-2 gap-3 text-zinc-800">
          <li><b>Очищение:</b> {plan.products.cleanser}</li>
          <li><b>Крем:</b> {plan.products.moisturizer}</li>
          <li><b>SPF:</b> {plan.products.spf}</li>
          <li><b>Барьер:</b> {plan.products.barrier}</li>
          <li><b>Актив A (утро):</b> {plan.products.activeA}</li>
          <li><b>Актив B (вечер):</b> {plan.products.activeB}</li>
        </ul>
      </section>

      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-3">Расписание на 28 дней</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {plan.days.map((d,idx)=>(
            <div key={idx} className="p-4 rounded-2xl border bg-white/60">
              <div className="font-semibold mb-2">День {idx+1}</div>
              <div className="text-sm"><b>Утро:</b> {d.morning.join(" → ")}</div>
              <div className="text-sm mt-1"><b>Вечер:</b> {d.evening.join(" → ")}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-zinc-500">Неделя 1 — без активов, Недели 2–4 — постепенный ввод согласно чувствительности.</div>
      </section>

      <section className="bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-2">Как читать план</h3>
        <ol className="list-decimal pl-5 space-y-1 text-zinc-700">
          <li>Вводи новые активы «через день». Если нет дискомфорта — увеличивай до через день/ежедневно.</li>
          <li>Патч-тест: нанеси немного на участок за ухом 24 ч.</li>
          <li>SPF ежедневно, даже зимой.</li>
          <li>При реакции — неделя барьерного ухода и откат частоты.</li>
        </ol>
        <div className="mt-4 flex gap-3 flex-wrap">
          <button onClick={downloadPDF} className="px-5 py-3 rounded-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition">
            📄 Скачать PDF
          </button>
          <button onClick={downloadPDFFromHTML} className="px-5 py-3 rounded-full border border-green-600 text-green-600 hover:bg-green-50 transition">
            🎨 PDF со стилями
          </button>
          <button onClick={()=>window.print()} className="px-5 py-3 rounded-full border border-gray-600 text-gray-600 hover:bg-gray-50 transition">
            🖨️ Печать
          </button>
          <button onClick={addAllToCart} className="px-5 py-3 rounded-full bg-black text-white hover:bg-stone-800 transition">
            🛒 Положить всё в корзину
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
